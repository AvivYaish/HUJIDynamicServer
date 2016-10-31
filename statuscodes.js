/*
 * File: statuscodes.js
 * Description: Contains constants and other things related to HTTP status codes.
 */

var STATUS_CODES = {};
var exports = module.exports = {};

exports.codeToMsg = function (code) {
    return STATUS_CODES[code];
};

// in this status code the socket close
exports.disconnectErrorCode = function (code) {
    return [404, 415, 403, 500, 414].indexOf(code) > -1;
};

//Status Code Numbering
exports.SUCCESS_OK = 200;
exports.NOT_FOUND = 404;
exports.UNSUPPORTED_MEDIA = 415;
exports.INTERNAL_SERVER_ERROR = 500;
exports.URI_TOO_LONG = 414;
exports.BAD_REQUEST = 400;
exports.FORBIDDEN = 403;

//
STATUS_CODES[exports.SUCCESS_OK] = "200 OK";
STATUS_CODES[exports.NOT_FOUND] = "404 Not Found";
STATUS_CODES[exports.UNSUPPORTED_MEDIA] = '415 Unsupported Media Type';
STATUS_CODES[exports.INTERNAL_SERVER_ERROR] = '500 Internal Server Error';
STATUS_CODES[exports.URI_TOO_LONG = 414] = '414 URI TOO LONG';
STATUS_CODES[exports.BAD_REQUEST] = '400 Bad Request';
STATUS_CODES[exports.FORBIDDEN] = "403 Forbidden";