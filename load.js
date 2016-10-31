/*
 * File: load.js
 * Description: Tries to load the server by issuing a lot of requests to many
 * different servers.
 */

var http = require('http'),
    hujiwebserver = require('./hujiwebserver.js'),
    statuscodes = require('./statuscodes.js');
http.globalAgent.maxSockets=1000;
// The number of servers to test simultaneously
var SERVER_NUM = 2;

// The number of times to run the tests
var LOAD_FACTOR = 10;

// The path of a status code test
var TEST_PATH_CELL = 0;

// The status code that a status code test should return
var TEST_STATUS_CODE_CELL = TEST_PATH_CELL + 1;

// The root path of the server
var ROOT_PATH = "./test";

// Resource that catches all requests
var ALL_RESOURCE = "/";

// Another resource
var PARAM_RESOURCE = "/:param1/:param2/:param3/:param4";

// A parameter
var FIRST_PARAM = "param1";

// The value it should have
var FIRST_PARAM_VAL = "python";

// A parameter
var SEC_PARAM = "param4";

// The value it should have
var SEC_PARAM_VAL = "js";

// The timeout before closing the servers
var CLOSE_TIMEOUT = 10000;

// The start port to use for the servers. Each sequential server will get
// the port of the last server + 1
var PORT = 8150;

// The callback function to use for the hujiwebserver.start
var SERVER_START_CALLBACK_FUNC = function (error, server) {
    if (error !== undefined) {
        throw new Error("Problem!");
    }
    server.use(ALL_RESOURCE, function (req, res, next) {
        next();
    });
    server.use(PARAM_RESOURCE, function (req, res, next) {
        if (req.param(FIRST_PARAM) !== FIRST_PARAM_VAL) {
            next();
        }
        if (req.param(SEC_PARAM) === SEC_PARAM_VAL) {
            res.status(statuscodes.SUCCESS_OK).send();
        } else {
            // checks how the server deals with many errors
            throw new Error();
        }
    });
    server.use(ALL_RESOURCE, hujiwebserver.static(ROOT_PATH));
    setTimeout(function () {
        server.stop();
    }, CLOSE_TIMEOUT);
};

// Tests to run, the file they run on and the response
// status code they should receive.
var STATUS_CODE_TESTS = {
    NONE_EXISTING_FILE: ["noneExisting.jpg", statuscodes.NOT_FOUND],
    NO_PERMISSION_PATH: ["../readme.txt", statuscodes.NOT_FOUND],
    NO_PERMISSION_PATH2: ["./../alon_ex2/../../readme.txt", statuscodes.NOT_FOUND],
    UNSUPPORTED_TYPE: ["/file.gdb", statuscodes.UNSUPPORTED_MEDIA],
    VALID_GET_EX2_ALON_HTML: ["/alon_ex2/index.html", statuscodes.SUCCESS_OK],
    VALID_GET_EX2_ALON_STYLE: ["/alon_ex2/style.css", statuscodes.SUCCESS_OK],
    VALID_GET_EX2_AVIV_INDEX: ["/aviv_ex2/index.html", statuscodes.SUCCESS_OK],
    VALID_GET_EX2_AVIV_JS: ["/aviv_ex2/main.js", statuscodes.SUCCESS_OK],
    PARAM_USE_ERROR1: ["/web/storm/ide/js", statuscodes.INTERNAL_SERVER_ERROR],
    PARAM_USE_ERROR2: ["/web/storm/ide/ruby", statuscodes.INTERNAL_SERVER_ERROR],
    PARAM_USE_VALID: ["/python/storm/ide/js", statuscodes.SUCCESS_OK]
};

// The request methods to check
var REQUEST_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'];

// Create the servers to test
for (var i = 0; i < SERVER_NUM; i++) {
    hujiwebserver.start(PORT + i, SERVER_START_CALLBACK_FUNC);
}

/**
 * Compares the result to what was expected and prints a message
 * @param expected The expected result
 * @param res The actual result
 * @param testName The name of the test
 * @param method The method of the test
 */
function assertExpected(expected, res, testName, method) {
    try {
        if (method === undefined) {
            method = "";
        }
        console.assert(expected === res.statusCode);
        console.log(method + " success: " + testName);
    }
    catch (E) {
        console.log("FAIL IN TEST:" + testName + "\n Expected:" + expected +
            "  Actual:" + res.statusCode + "\n")
    }
}

/**
 * Tests the status code and the HTTP method
 */
function testStatusAndMethods(port) {
    var testStatusCode = function (port, path, expected, method, testName) {
        var option = {
            port: port,
            path: path,
            agent: false,
            method: method
        };
        var req = http.request(option, function (res) {
                assertExpected(expected, res, testName, method);
            }
        );
        req.on('error', function (E) {
            console.log(E);
        });
        req.end();
    };

    REQUEST_METHODS.forEach(function (method) {
        for (var test in STATUS_CODE_TESTS) {
            if (!STATUS_CODE_TESTS.hasOwnProperty(test)) {
                return;
            }
            testStatusCode(port, STATUS_CODE_TESTS[test][TEST_PATH_CELL],
                STATUS_CODE_TESTS[test][TEST_STATUS_CODE_CELL], method, test);
        }
    });
}

/**
 * Performs the testing.
 */
function performTest() {
    for (var i = 0; i < LOAD_FACTOR; i++) {
        for (var j = 0; j < SERVER_NUM; j++) {
            testStatusAndMethods(PORT + j);
        }
    }
}

performTest();