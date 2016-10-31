/*
 * File: hujiparser.js
 * Description: Used for parsing requests and stringifying responses.
 */

var httprequest = require('./httprequest.js');

// The delimiter between lines
var LINE_DELIMITER = "\r{0,1}\n";

// The line break for stringify
var STRINGIFY_LINE_BREAK = "\r\n";

// A regex to match the line delimiter
exports.lineDelimiterRegex = new RegExp(LINE_DELIMITER);

// The delimiter between the header lines and the body
var BODY_DELIMITER = LINE_DELIMITER + LINE_DELIMITER;

// A regex to match the body's delimiter
var BODY_DELIMITER_REGEX = new RegExp(BODY_DELIMITER);

// The value matched by RegExp.exec()
var MATCH_VAL = 0;

/**
 * Parses a given String as an HTTP request.
 * @param String the string to parse.
 * @throws Error if the given String is not a valid HttpRequest.
 * @return An HttpRequest.
 */
exports.parse = function (String) {
    var headerLines, // The header lines contained in the HTTP request
        bodyMatch, // The body delimiter matched
        bodyStr, // The body of the HTTP request
        httpRequest; // An HttpRequest object.

    bodyMatch = BODY_DELIMITER_REGEX.exec(String);
    bodyStr = String.slice(bodyMatch.index + bodyMatch[MATCH_VAL].length);
    headerLines = String.slice(0, bodyMatch.index).split(exports.lineDelimiterRegex);
    try {
        httpRequest = new httprequest.httpRequest(headerLines, bodyStr);
    } catch (err) {
        throw err;
    }
    return httpRequest;
};

/**
 * Stringifies a given HttpResponseObject.
 * @param httpResponseObject The HttpResponse to convert to a string.
 * @return string representation of the given HttpResponse.
 */
exports.stringify = function (httpResponseObject) {
    var responseAsString, // The HTTP response as a string
        httpVer, // The version of the HTTP response
        responseStatus; // The response status code

    httpVer = httpResponseObject.httpVer;
    responseStatus = httpResponseObject.statusMsg;
    responseAsString = "HTTP/" + httpVer + " " + responseStatus + STRINGIFY_LINE_BREAK;
    Object.keys(httpResponseObject.headers).forEach(function (header) {
        responseAsString += header + httprequest.headerDelimiter + " " +
            httpResponseObject.headers[header] + STRINGIFY_LINE_BREAK;
    });
    httpResponseObject.cookies.forEach(function (cookie) {
        responseAsString += 'Set-Cookie' + httprequest.headerDelimiter +
            " " + cookie.name + "=" + cookie.value;
        for (var option in cookie.options) {
            if (cookie.options.hasOwnProperty(option)) {
                responseAsString += "; " + option + "=" + cookie.options[option];
            }
        }
        responseAsString += STRINGIFY_LINE_BREAK;
    });
    responseAsString += STRINGIFY_LINE_BREAK;
    if (httpResponseObject.body !== undefined) {
        responseAsString += httpResponseObject.body;
    }
    return responseAsString;
};