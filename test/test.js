'use strict';

/* global describe it beforeEach afterEach */
const chai = require('chai');
//const chaiAsPromised = require('chai-as-promised');
const fetch = require('node-fetch');
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
    let servers = {
        default: null,
        puppies: null,
        kittens: null
    };

    const ports = {
        proxy: 5000,
        default: 3000,
        kittens: 6000,
        puppies: 6001
    };

    const startDefaultServer = () => {
        servers.default = http.createServer((req, res) => {
            res.end(JSON.stringify({server: 'default'}));
        });

        console.log(`default listening on port ${ports.default}`);
        servers.default.listen(ports.default);
    };

    const startKittensServer = () => {
        servers.kittens = http.createServer((req, res) => {
            res.end(JSON.stringify({server: 'kittens'}));
        });

        console.log(`kittens listening on port ${ports.kittens}`);
        servers.kittens.listen(ports.kittens);
    };

    const startPuppiesServer = () => {
        servers.puppies = http.createServer((req, res) => {
            res.end(JSON.stringify({server: 'puppies'}));
        });

        console.log(`puppies listening on port ${ports.puppies}`);
        servers.puppies.listen(ports.puppies);
    };

    const sendHttpGetRequest = (path) => {
        return fetch(`http://localhost:${ports.proxy}/${path.replace(/^\//, '')}`)
    };

    before((done) => {
        startDefaultServer();
        startKittensServer();
        startPuppiesServer();

        done();
    });

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        serverless = new Serverless();

        return serverless.init().then(() => {
            serverless.config.servicePath = __dirname;

            serverlessProjectUtils = new ServerlessProjectUtils(serverless, {
                target: `http://localhost:${ports.default}`,
                port: ports.proxy
            });
        });
    });

    afterEach((done) => {
        if (serverlessProjectUtils && serverlessProjectUtils.server && serverlessProjectUtils.server) serverlessProjectUtils.server.close();
        sandbox.restore();
        done();
    });

    after((done) => {
        Object.keys(servers).forEach(k => servers[k] && servers[k].close());
        done();
    });

    describe('when no routes are loaded', () => {
        beforeEach(() => {
            serverlessProjectUtils.hooks['proxy:startProxyServer']();
        });

        it('should proxy all requests to default', () => {
            return Promise.all([
                sendHttpGetRequest('/kittens/11').then(result => {
                    assert.equal(result.status, 200);
                    return result.json().then(body => {
                        assert.equal(body.server, 'default');
                    });
                }),
                sendHttpGetRequest('/puppies/22').then(result => {
                    assert.equal(result.status, 200);
                    return result.json().then(body => {
                        assert.equal(body.server, 'default');
                    });
                }),
                sendHttpGetRequest('/fake').then(result => {
                    assert.equal(result.status, 200);
                    return result.json().then(body => {
                        assert.equal(body.server, 'default');
                    });
                })
            ]);
        });
    });

    describe('routes are loaded', () => {
        beforeEach(() => {
            serverlessProjectUtils.hooks['proxy:loadRoutes']();
            serverlessProjectUtils.hooks['proxy:startProxyServer']();
        });

        it('should store a routes for puppies and kittens', async () => {
            return serverlessProjectUtils.loadRoutesPromise.then(() => {
                // console.log(serverlessProjectUtils.routesByHttpMethod);

                const get = serverlessProjectUtils.routesByHttpMethod.GET;

                const getKitten = get[0];
                assert.equal(getKitten.path, 'kittens/{kittenId}');
                assert.equal(getKitten.port, ports.kittens);
                assert.equal(getKitten.debug, false);


                const getPuppy = get[1];
                assert.equal(getPuppy.path, 'puppies/{puppyId}');
                assert.equal(getPuppy.port, ports.puppies);
                assert.equal(getPuppy.debug, true);
            });
        });

        it('should proxy debug routes to matching localhost port and all others to default', () => {

            return Promise.all([
                sendHttpGetRequest('/kittens/11').then(result => {
                    assert.equal(result.status, 200);
                    return result.json().then(body => {
                        assert.equal(body.server, 'default');
                    });
                }),
                sendHttpGetRequest('/puppies/22').then(result => {
                    assert.equal(result.status, 200);
                    return result.json().then(body => {
                        assert.equal(body.server, 'puppies');
                    });
                }),
                sendHttpGetRequest('/fake').then(result => {
                    assert.equal(result.status, 200);
                    return result.json().then(body => {
                        assert.equal(body.server, 'default');
                    });
                })
            ]);
        });
    });

    // TODO : Test to validate proxy error if server goes down.
    // TODO : Test fo validate previx exists if serverless yaml contains local host or explict value.
});