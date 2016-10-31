/*
 * File: resourceHandlerObj.js
 * Description: Allows the creation and stopping of a hujidynamicserver.
 */

// A regex to match the resource parameters.
var PATH_REGEX = /\/:([^\/]*)/g;

// Given a path, replaces the parameters with this regex.
var RESOURCE_PARAM_REPLACEMENT = "/([^/]+)";

// Given a path, after replacing all the parameters with regular expressions,
// add this to the start of the resource regex.
var START_OF_LINE = "^";

// The match number of the first parameter match
var PARAMS_FIRST_MATCH = 1;

// The parameter property match
var PROPERTY_MATCH = 1;

/**
 * Given a resource, returns its parameters, and a new resource that replaces the
 * parameters with wildcards.
 * @param resource The resource to parse.
 * @param handleFunc The function that does the handling.
 * @param method The type of message the request handler should handle.
 * @constructor
 */
function RequestHandlerObj(resource, handleFunc, method) {
    this.method = method;
    this.handle = handleFunc;

    this.routeRegex = new RegExp(START_OF_LINE +
        resource.replace(PATH_REGEX, RESOURCE_PARAM_REPLACEMENT));
    this.params = [];
    this.firstMatchIndex = PARAMS_FIRST_MATCH;

    var result, count = 0;
    while ((result = PATH_REGEX.exec(resource)) !== null) {
        this.params[count] = result[PROPERTY_MATCH];
        count++;
    }
}

// Exposing the constructor to the outside
module.exports = RequestHandlerObj;