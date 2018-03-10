'use strict';

/* global describe it beforeEach afterEach */
const chai = require('chai');
//const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const http = require('http');
const Serverless = require('serverless');
const ServerlessProjectUtils = require('../src');


// chai.use(chaiAsPromised);
const assert = chai.assert;

describe('index.js', () => {

    let sandbox;
    let serverless;
    let serverlessProjectUtils;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        serverless = new Serverless();

        return serverless.init().then(() => {
            serverless.config.servicePath = __dirname;

            serverlessProjectUtils = new ServerlessProjectUtils(serverless, {
                target: 'http://localhost:3000'
            });
        });
    });

    afterEach((done) => {
        if (serverlessProjectUtils && serverlessProjectUtils.server && serverlessProjectUtils.server) serverlessProjectUtils.server.close();
        sandbox.restore();
        done();
    });

    it('should store a routes for puppies and kittens', async () => {
        return serverlessProjectUtils.hooks['proxy:loadRoutes']().then(() => {
            // console.log(serverlessProjectUtils.routesByHttpMethod);

            const get = serverlessProjectUtils.routesByHttpMethod.GET;

            const getKitten = get[0];
            assert.equal(getKitten.path, 'kittens/{kittenId}');
            assert.equal(getKitten.port, 5000);
            assert.equal(getKitten.debug, false);


            const getPuppy = get[1];
            assert.equal(getPuppy.path, 'puppies/{puppyId}');
            assert.equal(getPuppy.port, 5001);
            assert.equal(getPuppy.debug, true);
        });
    });

    // it('should start a reverse proxy server and accept various requests', () => {
    //     serverlessProjectUtils.hooks['proxy:loadRoutes']();
    //     serverlessProjectUtils.hooks['proxy:startProxyServer']();
    //
    //
    //     //console.log(serverlessProjectUtils.server);
    //     assert.equal(true, true);
    // });


    // describe('When requesting puppies, the request should go to localhost:5000
    // describe('When requesting kittens the request should proxy to localhost:3000

    /*
    const server = http.createServer((req, res) => {
        console.log("LOCAL SERVER", req.url, req.method);
        res.end();
    });
    server.listen(3000);
    */


});