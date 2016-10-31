/*
 * File: httprequest.js
 * Description: Various definitions and functions for HTTP requests.
 */

var querystring = require('querystring'),
    cookie = require('cookie'),
    typeis = require('type-is');

// Supported request methods.
var REQUEST_METHODS =
    ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTION', 'TRACE'];

// HTTP versions supported and the mandatory properties for them
var HTTP_VERSIONS = {
    "1.0": [], // HTTP version 1.0 doesn't have any required fields.
    "1.1": ["host"]
};

// The line number of the initial request line
var REQUEST_LINE_NUM = 0;

// The cells that hold the request type, the URI, and the HTTP version
var REQUEST_TYPE_CELL = 1;
var URI_PATH_CELL = REQUEST_TYPE_CELL + 1;
var HTTP_VER_CELL = URI_PATH_CELL + 1;

// The cells that hold the header name and the header's value
var HEADER_NAME_CELL = 1;
var HEADER_VALUE_CELL = HEADER_NAME_CELL + 1;

// The supported protocol
var PROTOCOL = "HTTP";

// The regular expression for the request line.
var REQUEST_LINE_REGEX = new RegExp('(' + REQUEST_METHODS.join('|') + ") " +
    "(.*)+ " + PROTOCOL + "/(" + (Object.keys(HTTP_VERSIONS)).join('|') + ')$');

// The delimiter between a header's name and value
exports.headerDelimiter = ":";

// The regular expression for the header lines.
var HEADER_LINE_REGEX = new RegExp("([^\\s]+)[\\s]*" + exports.headerDelimiter + "\\s*(.*)\\s*");

// The error message to throw if there's a header field missing
var MISSING_HEADER_FIELD_ERROR = " header field is missing, required by HTTP ";

// The delimiter for header values when a given header has multiple values.
var HEADER_VALUES_DELIMITER = ",";

// The name of the connection header.
var CONNECTION_HEADER = "connection";

// The value for connection that requires the connection to close after
// responding.
var CONNECTION_CLOSE_VAL = "close";

// The value for connection that requires the connection to stay alive.
var CONNECTION_KEEP_ALIVE_VAL = "keep-alive";

// An HTTP version that needs automatic disconnection.
var AUTO_DISCONNECT_HTTP_VER = "1.0";

// A regex to match the content length header.
var CONTENT_LENGTH_REGEX = new RegExp("Content-Length:\\s+([0-9]+)\\s+");

// If the content length regex found a match, the length will be in this cell.
var CONTENT_LENGTH_CELL = 1;

// The character to separate the resource path from the query
var QUERY_CHAR = '?';

// Empty string.
var EMPTY = "";

// A regex to match the hostname header
var HOSTNAME_REGEX = new RegExp("([\\w\\.]+)\\s*(\\:\\s*([\\d]+))?");

// The match group of the actual hostname.
var HOSTNAME_MATCH_GROUP = 1;

// The header name for the hostname field.
var HOSTNAME_HEADER_NAME = "host";

// The field to check in the req.is(type) function
var IS_TYPE_FIELD = "content-type";

// The regex group of the name of the cookie
var NAME_GROUP = 1;

// The regex group of the value of the cookie
var VALUE_GROUP = 2;

// The separator between two cookies
var COOKIE_SEPARATOR = ';';

// The header of the cookie
var COOKIE_HEADER = "cookie";

// The regex for body parameters.
var BODY_PARAM_REGEX = new RegExp("(?:\\s*([^\\s]+)\\s*=\\s*([^\\s]+))+\\s*");

// The separator between two body parameters
var BODY_PARAM_SEPARATOR = "&";

/**
 * Given a string, decides if it is a content length header or not. If it is,
 * returns the content's length.
 * @param header the header to validate.
 * @return number The content's length, or null if the header isn't a content
 * length header.
 */
exports.contentLengthCheck = function (header) {
    var match = CONTENT_LENGTH_REGEX.exec(header);
    if (match !== null) {
        //find length of body
        return parseInt(match[CONTENT_LENGTH_CELL]);
    }
    return null;
};

/**
 * Returns the request line if there's a valid request line in the string,
 * and null otherwise.
 * @param String the string to validate
 * @return Array An array with information about the matched valid request
 * line, or null if there's no match.
 */
exports.isRequestLineValid = function (String) {
    return REQUEST_LINE_REGEX.exec(String);
};

/**
 * Returns the header line if there's a valid request line in the string,
 * and null otherwise.
 * @param String The string to validate.
 * @return Array An array with information about the matched valid header
 * line, or null if there's no match.
 */
exports.isHeaderLineValid = function (String) {
    return HEADER_LINE_REGEX.exec(String);
};

/**
 * Decides if the connection of the request should be closed after sending
 * a response.
 * @param httpRequest the request to check.
 * @return boolean true if the connection of the request should be disconnected
 * after sending a response or false otherwise.
 */
function shouldDisconnect(httpRequest) {
    if (!httpRequest.headers.hasOwnProperty(CONNECTION_HEADER)) {
        if (httpRequest.httpVer === AUTO_DISCONNECT_HTTP_VER) {
            return true;
        }
    } else if (httpRequest.headers[CONNECTION_HEADER] === CONNECTION_CLOSE_VAL) {
        return true;
    } else if (httpRequest.headers[CONNECTION_HEADER] === CONNECTION_KEEP_ALIVE_VAL) {
        return false;
    }
    return true;
}

/**
 * Given the headerLines and the start index of the headers, adds the headers to the request.
 * @param headerLines Lines of headers.
 * @param headersStart The headers start index.
 */
HttpRequest.prototype.addHeaders = function (headerLines, headersStart) {
    var curHeader, // The current header from the headerLines
        curHeaderName; // The current header's name

    // Add the request headers to the request object.
    var i;
    for (i = headersStart; i < headerLines.length; i++) {
        curHeader = HEADER_LINE_REGEX.exec(headerLines[i]);
        curHeaderName = curHeader[HEADER_NAME_CELL].toLowerCase();

        // according to Ohad there's no need to check if the header
        // continues in another line, even though the specification allows it
        if (!this.headers.hasOwnProperty(curHeaderName)) {
            this.headers[curHeaderName] = curHeader[HEADER_VALUE_CELL];
        } else {
            this.headers[curHeaderName] += HEADER_VALUES_DELIMITER + curHeader[HEADER_VALUE_CELL];
        }
    }

    // Check that the HTTP request has all the required fields according to its HTTP version
    for (i = 0; i < HTTP_VERSIONS[this.httpVer].length; i++) {
        if (!this.headers.hasOwnProperty((HTTP_VERSIONS[this.httpVer])[i])) {
            throw new Error((HTTP_VERSIONS[this.httpVer])[i] +
                MISSING_HEADER_FIELD_ERROR + this.httpVer);
        }
    }
};

/**
 * Get the case-insensitive request header field.
 * @param name The name of the field.
 * @returns undefined if it doesn't exist, it's value otherwise.
 */
HttpRequest.prototype.get = function (name) {
    // check if the header exists, act accordingly.
    var lowerCaseName = name.toLowerCase();
    if (this.headers.hasOwnProperty(lowerCaseName)) {
        return this.headers[lowerCaseName];
    }
    return undefined;
};

/**
 * Check if the incoming request contains the "Content-Type" header field, and if it
 * matches the give mime type.
 * @param type The type to compare the content-type to.
 * @returns {boolean} true if type is equl to content-type, false otherwise.
 */
HttpRequest.prototype.is = function (type) {
    if (this.headers.hasOwnProperty(IS_TYPE_FIELD)) {
        return typeis.match(typeis.normalize(type), this.headers[IS_TYPE_FIELD]);
        return this.headers[IS_TYPE_FIELD] === type;
    }
    return false;
};

/**
 * Return the value of param name when present.
 * @param name The param name to look for.
 * @param defaultValue The default value to return if it isn't present.
 * @returns {*} The parameter name if exists in params or in query, default value otherwise.
 */
HttpRequest.prototype.param = function (name, defaultValue) {
    if (this.params.hasOwnProperty(name)) {
        return this.params[name];
    } else if (this.bodyParams.hasOwnProperty(name)) {
        return this.bodyParams[name];
    } else if (this.query.hasOwnProperty(name)) {
        return this.query[name];
    }
    return defaultValue;
};

/**
 * Goes over the cookie header, formats the cookies and adds them to the object.
 */
HttpRequest.prototype.addCookies = function () {
    if (this.headers.hasOwnProperty(COOKIE_HEADER)) {
        this.cookies = cookie.parse(this.headers[COOKIE_HEADER]);
    }
};

/**
 * Parses the body and adds parameters if there are any present.
 */
HttpRequest.prototype.addBodyParams = function () {
    try {
        this.bodyParams = JSON.parse(this.body);
    } catch (err) {
        var bodyParamsPtr = this.bodyParams,
            result;
        this.body.split(BODY_PARAM_SEPARATOR).forEach(function (curParam) {
            result = BODY_PARAM_REGEX.exec(curParam);
            if (result !== null) {
                bodyParamsPtr[result[NAME_GROUP]] = result[VALUE_GROUP];
            }
        });
    }
};

/**
 * Constructs an HttpRequest object using an array of header lines and a
 * string representation of the body.
 * @param headerLines The header lines of the request.
 * @param bodyStr The string representation of the request body.
 * @throws Error if there aren't headers that are required by the HTTP version.
 * @constructor
 */
function HttpRequest(headerLines, bodyStr) {
    var requestLine; // The request line of the HttpRequest
    requestLine = REQUEST_LINE_REGEX.exec(headerLines[REQUEST_LINE_NUM]);

    // Adds the query field according to the request URI
    var queryStartIndex = requestLine[URI_PATH_CELL].indexOf(QUERY_CHAR);
    if (queryStartIndex === -1) {
        this.path = requestLine[URI_PATH_CELL]; // The URI path of the request.
        this.query = {}; // The query of the request URI
    } else {
        this.path = requestLine[URI_PATH_CELL].substring(0, queryStartIndex);
        this.query = querystring.parse(requestLine[URI_PATH_CELL].substring(queryStartIndex + 1));
    }

    this.method = requestLine[REQUEST_TYPE_CELL]; // Whether the request is GET, POST, etc.
    this.protocol = PROTOCOL; // The request protocol
    this.httpVer = requestLine[HTTP_VER_CELL]; // The version of the HTTP req
    this.params = {}; // Contains the request parameters.
    this.cookies = {}; // The cookies of the request
    this.headers = {}; // The headers of the request.
    this.addHeaders(headerLines, REQUEST_LINE_NUM + 1);
    this.addCookies();
    this.shouldDisconnect = shouldDisconnect(this); // true if the connection should close after
                                                    // responding to it

    // Add the hostname field according to the host header
    if (this.headers.hasOwnProperty(HOSTNAME_HEADER_NAME)) {
        var hostnameMatch = HOSTNAME_REGEX.exec(this.headers[HOSTNAME_HEADER_NAME]);
        if (hostnameMatch === null) {
            this.host = this.headers[HOSTNAME_HEADER_NAME];
        } else {
            this.host = hostnameMatch[HOSTNAME_MATCH_GROUP];
        }
    } else {
        this.host = undefined;
    }

    this.bodyParams = {}; // The request body parsed as an object of parameters
    if (bodyStr === EMPTY) {
        this.body = null;   // The request body.
    } else {
        this.body = bodyStr;
        this.addBodyParams();
    }
}

/**
 * Constructs an HttpRequest object using an array of header lines and a
 * string representation of the body.
 * @param headerLines The header lines of the request.
 * @param bodyStr The string representation of the request body.
 * @throws Error if there aren't headers that are required by the HTTP version.
 */
exports.httpRequest = function (headerLines, bodyStr) {
    return new HttpRequest(headerLines, bodyStr);
};