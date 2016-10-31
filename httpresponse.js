/*
 * File: httpresponse.js
 * Description: Various definitions and functions for HTTP response.
 */
var fs = require('fs'),
    statusCodes = require('./statuscodes.js'),
    path = require('path');

//
var RESPONSE_HTTP_VER_BASIC = "1.0";


var CONTENT_LENGTH = 'Content-Length';


var CONTENT_TYPE = 'Content-Type';

//
var CONTENT_TYPE_EXT = {
    js: "application/javascript",
    html: "text/html",
    txt: "text/plain",
    css: "text/css",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    gif: "image/gif",
    png: "image/png",
    json: 'application/json'
};

// The error message when a request was received with error
var REQUEST_ERR_MSG = "Request was received with error.";

/**
 *  this function create ResponseObject
 * @param hujinet
 * @returns {ResponseObj}
 */
module.exports = function response(hujinet, req) {
    return new ResponseObj(hujinet, req);
};

/**
 *
 * @param hujinet the hujinet object that received the request.
 * @param req , the request the read from hujinet
 * @constructor , constructor for the responseObject
 * @throws error in case that was error in the req.
 */
function ResponseObj(hujinet, req) {
    this.net = hujinet;
    this.headers = {};
    this.cookies = [];
    this.httpVer = req.httpVer;
    this.shouldDisconnect = req.shouldDisconnect || req.error !== undefined;

    if (req.error !== undefined) {
        this.httpVer = RESPONSE_HTTP_VER_BASIC;
        this.error = true;

        this.status(req.error).send();

        throw new Error(REQUEST_ERR_MSG);
    }
}

/**
 * This function sends the body, sets it's content length header to the response
 * @param body The content to send.
 */
ResponseObj.prototype.send = function (body) {
    this.body = body;
    try {
        if (!body) {
            this.set(CONTENT_LENGTH, 0);
        } else {
            this.set(CONTENT_LENGTH, body.length);
        }
    } catch (err) {
        this.set(CONTENT_LENGTH, 0);
        this.status(statusCodes.INTERNAL_SERVER_ERROR);
        this.body = "";
    }
    this.net.sendResponse(this, this.shouldDisconnect);
};

/**
 * add cookie to the response
 * @param name : name of the cookie
 * @param value : value of the cookie
 * @param options : options for the cookie: domain, path, secure, expires, maxAge, httpOnly, signed.
 */
ResponseObj.prototype.cookie = function (name, value, options) {
    this.cookies.push({
        name: name,
        value: value,
        options: options
    });
    return this;
};

/**
 *
 * @param body : the json that want to send
 * @returns {*} send the body as json and return the ResponseObject
 */
ResponseObj.prototype.json = function (body) {
    try {
        var jsonBody = JSON.stringify(body);
    } catch (err) {
        this.status(statusCodes.INTERNAL_SERVER_ERROR).send();
        return;
    }

    if (!this.get(CONTENT_TYPE)) {
        this.set(CONTENT_TYPE, CONTENT_TYPE_EXT.json);
    }

    return this.send(jsonBody);
};

/**
 * @param code the status code
 * @returns {ResponseObj}
 */
ResponseObj.prototype.status = function (code) {
    //if the code contain also msg. like 404 Not Found
    var codeInt = parseInt(code);
    this.statusCode = codeInt;
    this.statusMsg = statusCodes.codeToMsg(codeInt);

    if (!this.statusMsg) {
        this.statusMsg = code;
    }
    return this;
};

/**
 * this function return the value of the header
 * @param field the header that we want to get the value of.
 * @returns {*}
 */
ResponseObj.prototype.get = function (field) {
    return this.headers[field.toLowerCase()];
};

/**
 * This function set value to header.
 * @param field : header field
 * @param value : value of the header
 */
ResponseObj.prototype.set = function (field, value) {

    this.headers[field.toLowerCase()] = value;
};

/**
 * this function send a file. generate the content type header if it does not set before
 * @param fullPath path to the file.
 * @returns {ResponseObj}
 */
ResponseObj.prototype.sendFile = function (fullPath) {
    var extName;
    if (!this.get(CONTENT_TYPE)) {
        extName = CONTENT_TYPE_EXT[path.extname(fullPath).substring(1)];
        this.set(CONTENT_TYPE, extName);
    }

    if (extName) {
        this.net.sendResponse(this, false);
        this.net.sendFile(fs.createReadStream(fullPath), this.shouldDisconnect);
    } else {
        this.error = true;
        this.status(statusCodes.UNSUPPORTED_MEDIA).net.sendResponse(this, true);
    }
    return this;
};