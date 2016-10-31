/*
 * File: hujinet.js
 * Description: Used for communication between the server and clients.
 */

var httprequest = require('./httprequest.js');
var hujiparser = require('./hujiparser.js');
var statuscodes = require('./statuscodes.js');

// The value to pass to split in order to split by characters.
var SPLIT_BY_CHAR = "";

// The line delimiter
var LINE_DELIMITER = '\n';

// The maximal length for an HTTP request
var REQUEST_MAX_LENGTH = 8194;

// The name of the socket timeout event.
var TIMEOUT_EVENT = 'timeout';

// The name of the socket data event.
var DATA_EVENT = 'data';

/**
 * A function that create HujiNet object.
 * @param socketDec Socket to listen to.
 * @return Object A new HujiNet object.
 */
exports.create = function (socket) {
   return new HujiNet(socket)

};

/**
 * constructor of the HujiNet.
 * @param socket the socket or the hujiNet. all the network opration will
 * be about this socket.
 * @constructor
 */
function HujiNet(socket){
    this.socket = socket;
}

/**
 * A function that receive a file content to send.
 * write responseHttp text to the socket.
 * fileStream object create by fs.CreateReadStream.
 * @param socket the socket to use
 * @param httpResponse the response to send
 * @param shouldDisconnect if case === true  the socket will close.
 */
HujiNet.prototype.sendResponse = function(httpResponse, shouldDisconnect) {
    var httpResponseString = hujiparser.stringify(httpResponse);
    if (!this.socket.writable){
        return
    }
    if (httpResponse.error) {
        // on error, send the response and close the socket.
        this.socket.end(httpResponseString);
    }
    else {
        if (shouldDisconnect || statuscodes.disconnectErrorCode(httpResponse.statusCode)) {
            this.socket.end(httpResponseString);
        } else {
            this.socket.write(httpResponseString);
        }
    }
    this.sendSuccess = true;
};

/**
 * this function receive stream and send this stream to the socket.
 * @param stream  the stream to send.
 * @param shouldDisconnect if case === true  the socket will close.
 */
HujiNet.prototype.sendFile = function (stream, shouldDisconnect) {
    var socket = this.socket;
    var context = this;
    if (!this.socket.writable){
        return;
    }
    stream.pipe(socket, {end: false});
    stream.on('end', function () {
        if (shouldDisconnect) {
            socket.end();
        }
        context.sendSuccess = true;
    });
    stream.on('error', function (err) {
    });
};

/**
 * A function that listen to the socket.
 * find HTTP request. and give the string to the parser.
 * call to the callback function with the HttpRequest as a parameter.
 * @param callback A callback function to run when an HTTP request is received.
 */
HujiNet.prototype.listen = function(callback) {
    var reqObj;
    var socket = this.socket;
    var context = this;
    var isInSideRequest, // true if the request in progress
        isInSideBody, //true if the body reading in progress
        lineBuffer,//the current line until this iteration.
        requestStr, //the string of the request
        lengthOfBody;// the Content-length header value.

    var init = function () {
        isInSideRequest = false;
        isInSideBody = false;
        lineBuffer = "";
        requestStr = "";
        lengthOfBody = 0;
    };

    init();
    this.socket.on(TIMEOUT_EVENT, function () {
        if (context.sendSuccess === false && context.recivedRequest === true) {
            callback({error: statuscodes.NOT_FOUND})
        }
        socket.end();
    });
    this.socket.on(DATA_EVENT, function (data) {
        context.recivedRequest = false;
        context.sendSuccess = false;
        if (lineBuffer.length > REQUEST_MAX_LENGTH || data.length > REQUEST_MAX_LENGTH ||
                requestStr.length > REQUEST_MAX_LENGTH) {
            init();
            //request size is bigger than limit (8K) size.
            // callback with request 414 Request-URI Too Long
            callback({error: statuscodes.URI_TOO_LONG});
            return;
        }
        data.toString().split(SPLIT_BY_CHAR).forEach(function (char) {
            var requestTitle; // the title of the http request
            var requestHeader; // header of the request
            var indexEol; // index of the line delimiter of the body.
            lineBuffer += char;
            if (isInSideBody === false && char === LINE_DELIMITER) {
                requestTitle = httprequest.isRequestLineValid(
                    lineBuffer.slice(0,
                        lineBuffer.search(hujiparser.lineDelimiterRegex)));

                if (requestTitle !== null) {
                    //find title of request.
                    isInSideRequest = true;
                    requestStr = requestTitle[0] + LINE_DELIMITER;
                    lineBuffer = "";
                } else {
                    requestHeader = httprequest.isHeaderLineValid(
                        lineBuffer.slice(0, lineBuffer.search(
                            hujiparser.lineDelimiterRegex)));

                    if (isInSideRequest && requestHeader !== null) {
                        //find header.
                        requestStr += lineBuffer;
                        //check if the header is contentLength and put
                        //initialize the length of the body.
                        (function (length) {
                            if (length !== null) {
                                lengthOfBody = length;
                            }
                        })(httprequest.contentLengthCheck(lineBuffer));
                        lineBuffer = "";
                    } else if (lineBuffer.indexOf(LINE_DELIMITER) > 1) {
                        //no header line inside header section.
                        init();
                    }
                }
            }
            if (isInSideRequest === true) {
                //check if body start.
                indexEol = lineBuffer.indexOf(LINE_DELIMITER);
                if (isInSideBody === false && lineBuffer.search(
                        hujiparser.lineDelimiterRegex) === 0) {
                    requestStr += lineBuffer;
                    isInSideBody = true;
                    lineBuffer = lineBuffer.substring(indexEol + 1);
                }
                if (isInSideBody === true &&
                    lineBuffer.length === lengthOfBody) {
                    //end of request
                    requestStr += lineBuffer;

                    try {
                        reqObj = hujiparser.parse(requestStr);
                    } catch (error) {
                        reqObj = {error: statuscodes.BAD_REQUEST};
                    }
                    context.recivedRequest = true;
                    callback(reqObj);
                    init(this);
                }
            }
        });
    });
};