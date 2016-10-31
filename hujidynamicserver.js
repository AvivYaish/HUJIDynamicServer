/*
 * File: hujidynamicserver.js
 * Description: Allows the creation and stopping of a hujidynamicserver.
 */

var net = require('net'),
    path = require('path'),
    hujinet = require('./hujinet.js'),
    httpresponse = require('./httpresponse.js'),
    statuscodes = require('./statuscodes.js'),
    requesthandlerobj = require('./requesthandlerobj.js');

// The default timeout for a connection
var DEFAULT_CONNECTION_TIMEOUT = 2000;

// The IP for the localhost
var LOCALHOST_IP = "127.0.0.1";

// The name of the the server listening event
var SERVER_LISTENING_EVENT = "listening";

// The error event for a server
var SERVER_ERROR_EVENT = "error";

// The allowed type for port
var ALLOWED_TYPE = 'number';

// The error message for an invalid port
var INVALID_PORT_ERR_MSG = " port is invalid.";

// The minimal value for port
var MIN_PORT = 1;

// The default resource to use if no one was given.
var DEFAULT_RESOURCE = "/";

// Supported request methods.
var SUPPORTED_METHODS = {
    ALL: 'ALL',
    GET: 'GET',
    HEAD: 'HEAD',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE'
};

/**
 * Checks if a given port is valid
 * @param port The port to check.
 * @return boolean True if the port is valid, false otherwise.
 */
function isValidPort(port) {
    return !((typeof port !== ALLOWED_TYPE) || ((port % 1) !== 0) || (port < MIN_PORT));
}

/**
 * Stops the server.
 */
HujiDynamicServer.prototype.stop = function () {
    try {
        this.server.close();
    } catch (err) {}
};

/**
 * Gives the server a requestHandler that should handle any request with the given
 * resource as a prefix and which is of the specified method.
 * @param resource The prefix of the resource to handle.
 * @param requestHandler Function that receives the arguments: an HTTP request,
 * an HTTP response and a function next
 * @param method The method the requestHandler should handle.
 */
HujiDynamicServer.prototype.use = function (resource, requestHandler, method) {
    if (resource === null || resource === undefined) {
        return;
    }
    if (requestHandler === undefined) {
        requestHandler = resource;
        resource = DEFAULT_RESOURCE;
    }
    if ((method === undefined) || (!SUPPORTED_METHODS.hasOwnProperty(method))) {
        method = SUPPORTED_METHODS.ALL;
    }
    if (Object.prototype.toString.call(requestHandler) === '[object Function]') {
        this.handlers.push(new requesthandlerobj(resource, requestHandler, method));
    }
};

/**
 * Same as use, but only for get.
 * @param resource The prefix of the resource to handle.
 * @param requestHandler Function that receives the arguments: an HTTP request,
 * an HTTP response and a function next
 */
HujiDynamicServer.prototype.get = function (resource, requestHandler) {
    this.use(resource, requestHandler, SUPPORTED_METHODS.GET);
};

/**
 * Same as use, but only for post.
 * @param resource The prefix of the resource to handle.
 * @param requestHandler Function that receives the arguments: an HTTP request,
 * an HTTP response and a function next
 */
HujiDynamicServer.prototype.post = function (resource, requestHandler) {
    this.use(resource, requestHandler, SUPPORTED_METHODS.POST);
};

/**
 * Same as use, but only for delete.
 * @param resource The prefix of the resource to handle.
 * @param requestHandler Function that receives the arguments: an HTTP request,
 * an HTTP response and a function next
 */
HujiDynamicServer.prototype.delete = function (resource, requestHandler) {
    this.use(resource, requestHandler, SUPPORTED_METHODS.DELETE);
};

/**
 * Same as use, but only for put.
 * @param resource The prefix of the resource to handle.
 * @param requestHandler Function that receives the arguments: an HTTP request,
 * an HTTP response and a function next
 */
HujiDynamicServer.prototype.put = function (resource, requestHandler) {
    this.use(resource, requestHandler, SUPPORTED_METHODS.PUT);
};

/**
 * Creates a dynamic server.
 * @param port The port to listen to.
 * @param callback The function to call if the server couldn't start.
 * @constructor
 */
function HujiDynamicServer(port, callback) {
    if (!isValidPort(port)) {
        callback(new Error(port + INVALID_PORT_ERR_MSG), this);
        return;
    }

    this.handlers = [];
    var thisServer = this,
        eventFunc = function (err) {
            callback(err, thisServer);
        };

    this.server = net.createServer(function (socket) {
        socket.setTimeout(DEFAULT_CONNECTION_TIMEOUT);
        var serverHujiNet = hujinet.create(socket);
        serverHujiNet.listen(function (httpRequest) {
            var response, next;
            try {
                response = httpresponse(serverHujiNet, httpRequest);
            } catch (err) {
                return;
            }

            next = function () {
                var handlers = thisServer.handlers;
                var match;
                while ((next.curHandler < handlers.length) &&
                ((httpRequest.method !== handlers[next.curHandler].method &&
                handlers[next.curHandler].method !== SUPPORTED_METHODS.ALL) ||
                (match = handlers[next.curHandler].routeRegex.exec(httpRequest.path)) === null)) {
                    next.curHandler++;
                }

                if (next.curHandler < handlers.length) {
                    // Goes over the route parameters and adds them as properties.
                    httpRequest.params = {};
                    for (var j = handlers[next.curHandler].firstMatchIndex; j < match.length; j++) {
                        httpRequest.params[handlers[next.curHandler].params[j - 1]] = match[j];
                    }
                    next.curHandler++;
                    try {
                        handlers[next.curHandler - 1].handle(httpRequest, response, next);
                    } catch (err) {
                        response.status(statuscodes.INTERNAL_SERVER_ERROR).send();
                    }
                } else {
                    response.status(statuscodes.NOT_FOUND).send();
                }
            };
            next.curHandler = 0;
            next();
        });
    });

    this.server.on(SERVER_LISTENING_EVENT, eventFunc);
    this.server.on(SERVER_ERROR_EVENT, eventFunc);
    this.server.listen(port, LOCALHOST_IP);
}

// Exposing the constructor for a HujiDynamicServer to the outside.
exports.hujiDynamicServer = HujiDynamicServer;