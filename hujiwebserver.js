/*
 * File: hujiwebserver.js
 * Description: Allows the starting and stopping of a hujiwebserver.
 */

var hujidynamicserver = require('./hujidynamicserver.js'),
    fs = require('fs'),
    statuscodes = require('./statuscodes.js'),
    path = require('path');

// The path to move the folder up
var FOLDER_UP = "..";

// The error message when a given root path for a server isn't a directory.
var NOT_DIRECTORY_ERROR_MSG = " isn't a directory.";

// The error message when a given path doesn't point to a file.
var NOT_FILE_ERROR_MSG = " isn't a file.";

// A separator for path
var PATH_SEPARATOR = "./";

// The string to be returned by myUse.toString()
var MY_USE_USAGE = "myUse checks if the request has a cookie with the name specified " +
    "by the cookieName parameter and if the callback function returns true on the cookies " +
    "value. If it doesn't it redirects the user to a page specified by pagePath.\n" +
    "myUse receives these parameters: \n" +
    "pagePath Should be the path to the redirection page. \n" +
    "cookieName Should be the name of the cookie that contains the needed data.\n" +
    "callback Should be a function that receives a value and returns a boolean value.\n" +
    "If you want the server to check if the cookie is valid before doing anything else, " +
    "use myUse before any other use/get/post/etc, and also specify the resource as '/'.";

/**
 * Starts a server.
 * @param port The port to listen to.
 * @param callback A function that receives and error and a server
 */
exports.start = function (port, callback) {
    new hujidynamicserver.hujiDynamicServer(port,callback);
};

/**
 * A function that generates handlers for static content.
 * @param rootFolder The root folder to look at.
 * @returns {Function} A handler function to handle requests for static resources.
 */
exports.static = function (rootFolder) {
    fs.stat(rootFolder, function (err, stats) {
        if (err || !stats.isDirectory()) {
            throw new Error(rootFolder + NOT_DIRECTORY_ERROR_MSG);
        }
    });
    return function (req, res, next) {
        var requirePath = path.normalize(req.path);
        var fullPath = path.join(rootFolder, requirePath);
        if (rootFolder.indexOf(PATH_SEPARATOR) === 0 && fullPath.indexOf(PATH_SEPARATOR) !== 0) {
            fullPath = PATH_SEPARATOR + fullPath;
        }
        if (requirePath.indexOf(FOLDER_UP) >= 0) {
            next();
            return;
        }
        fs.stat(fullPath, function (err, stat) {
            if (err) {
                next();
                return;
            }
            res.set("Content-Length", stat.size);
            res.status(statuscodes.SUCCESS_OK).sendFile(fullPath);
        });
    }
};

/**
 * /**
 * Checks if there is a certain cookie in the request. If so, runs the callback
 * on it's value. If the callback returns true, proceed as usual, else redirect
 * the user to a certain page.
 * @param pagePath A local path for the login page.
 * @param cookieName The name of the login cookie.
 * @param callback A function that receives a single parameter and returns a boolean value.
 * @returns {*} If not enough parameters were given, returns the usage.
 * Else, returns the myUsage use function.
 */
function myUse(pagePath, cookieName, callback) {
    if (pagePath === undefined || cookieName === undefined || callback === undefined) {
        return MY_USE_USAGE;
    }
    pagePath = path.resolve(pagePath);
    fs.stat(pagePath, function (err, stats) {
        if (err || !stats.isFile()) {
            throw new Error(pagePath + NOT_FILE_ERROR_MSG);
        }
    });
    return function (req, res, next) {
        if (!req.cookies.hasOwnProperty(cookieName) || !callback(req.cookies[cookieName])) {
            fs.stat(pagePath, function (err, stat) {
                if (err) {
                    next();
                    return;
                }
                res.set("Content-Length", stat.size);
                res.status(statuscodes.SUCCESS_OK).sendFile(pagePath);
            });
        } else {
            next();
        }
    }
}

// Exposing myUse to the outside world.
exports.myUse = myUse;