'use strict';

/* global describe it beforeEach afterEach */
const fs = require('fs');
const path = require('path');
const chai = require('chai');
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
        bears: 5999,
        kittens: 6000,
        puppies: 6001,
        turtles: 6002
    };

    const startDefaultServer = () => {
        servers.default = http.createServer((req, res) => {
            res.end(JSON.stringify({server: 'default', url: req.url}));
        });

        console.log(`default listening on port ${ports.default}`);
        servers.default.listen(ports.default);
    };

    const startBearsServer = () => {
        servers.bears = http.createServer((req, res) => {
            res.end(JSON.stringify({server: 'bears', url: req.url}));
        });

        console.log(`bears listening on port ${ports.bears}`);
        servers.bears.listen(ports.bears);
    };

    const startKittensServer = () => {
        servers.kittens = http.createServer((req, res) => {
            res.end(JSON.stringify({server: 'kittens', url: req.url}));
        });

        console.log(`kittens listening on port ${ports.kittens}`);
        servers.kittens.listen(ports.kittens);
    };

    const startPuppiesServer = () => {
        servers.puppies = http.createServer((req, res) => {
            res.end(JSON.stringify({server: 'puppies', url: req.url}));
        });

        console.log(`puppies listening on port ${ports.puppies}`);
        servers.puppies.listen(ports.puppies);
    };

    const startTurtlesServer = () => {
        servers.turtles = http.createServer((req, res) => {
            res.end(JSON.stringify({server: 'turtles', url: req.url}));
        });

        console.log(`turtles listening on port ${ports.turtles}`);
        servers.turtles.listen(ports.turtles);
    };

    const sendHttpGetRequest = (path) => {
        return fetch(`http://localhost:${ports.proxy}/${path.replace(/^\//, '')}`)
    };

    before((done) => {
        startDefaultServer();
        startBearsServer();
        startKittensServer();
        startPuppiesServer();
        startTurtlesServer();

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
        if (serverlessProjectUtils) {
            if (serverlessProjectUtils.server && serverlessProjectUtils.server.close) serverlessProjectUtils.server.close();
            if (serverlessProjectUtils.watcher && serverlessProjectUtils.watcher.close)serverlessProjectUtils.watcher.close();
        }
        sandbox.restore();
        done();
    });

    after((done) => {
        Object.keys(servers).forEach(k => servers[k] && servers[k].close());
        done();
        // NOTE: gulp watch not fully exiting on travis ci, or when ran with webstorm run.
        // NOTE: does exit when ran directly via cli using `npm run test`
        setTimeout(() => process.exit(0), 500);
    });

    describe('when no routes are loaded', () => {
        beforeEach((done) => {
            serverlessProjectUtils.hooks['proxy:startProxyServer']();
            done();
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

    describe('when routes are loaded with watch set to false', () => {
        beforeEach((done) => {
            serverlessProjectUtils.options.watch = false;
            serverlessProjectUtils.commands.proxy.lifecycleEvents.forEach(e => {
                serverlessProjectUtils.hooks[`proxy:${e}`]();
            });
            done();
        });

        it('should store the routes for bears, puppies, kittens, and turtles', () => {
            return serverlessProjectUtils.loadRoutesPromise.then(() => {
                const get = serverlessProjectUtils.routesByHttpMethod.GET;

                const getBear = get[0];
                assert.equal(getBear.pathPrefix, 'http/');
                assert.equal(getBear.path, 'bears/{bearId}');
                assert.equal(getBear.port, ports.bears);
                assert.equal(getBear.debug, true);

                const getKitten = get[1];
                assert.equal(getKitten.pathPrefix, '');
                assert.equal(getKitten.path, 'kittens/{kittenId}');
                assert.equal(getKitten.port, ports.kittens);
                assert.equal(getKitten.debug, false);


                const getPuppy = get[2];
                assert.equal(getPuppy.pathPrefix, '');
                assert.equal(getPuppy.path, 'puppies/{puppyId}');
                assert.equal(getPuppy.port, ports.puppies);
                assert.equal(getPuppy.debug, true);


                const getTurtle = get[3];
                assert.equal(getTurtle.pathPrefix, 'local/api/');
                assert.equal(getTurtle.path, 'turtles/{turtleId}');
                assert.equal(getTurtle.port, ports.turtles);
                assert.equal(getTurtle.debug, true);
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

        it('should prefix local urls for bears and turtles', () => {
            return Promise.all([
                sendHttpGetRequest('/bears/00').then(result => {
                    assert.equal(result.status, 200);
                    return result.json().then(body => {
                        assert.equal(body.url, '/http/bears/00');
                    });
                }),
                sendHttpGetRequest('/kittens/11').then(result => {
                    assert.equal(result.status, 200);
                    return result.json().then(body => {
                        assert.equal(body.url, '/kittens/11');
                    });
                }),
                sendHttpGetRequest('/puppies/22').then(result => {
                    assert.equal(result.status, 200);
                    return result.json().then(body => {
                        assert.equal(body.url, '/puppies/22');
                    });
                }),
                sendHttpGetRequest('/turtles/33').then(result => {
                    assert.equal(result.status, 200);
                    return result.json().then(body => {
                        assert.equal(body.url, '/local/api/turtles/33');
                    });
                }),
                sendHttpGetRequest('/fake').then(result => {
                    assert.equal(result.status, 200);
                    return result.json().then(body => {
                        assert.equal(body.url, '/fake');
                    });
                }),
            ]);
        });

        describe('a proxy server stops listening', () => {
            before((done) => {
                servers.puppies.close();
                done();
            });

            it('should return a proxy error', () => {
                return Promise.all([
                    sendHttpGetRequest('/puppies/22').then(result => {
                        assert.equal(result.status, 504);
                        return result.json().then(body => {
                            assert.deepEqual(body.error, {
                                address: "127.0.0.1",
                                code: "ECONNREFUSED",
                                errno: "ECONNREFUSED",
                                port: 6001,
                                syscall: "connect"
                            });
                            assert.equal(body.message, 'Unable to proxy request');
                        });
                    })
                ]);
            });
        });
    });

    describe('when routes are loaded and watch is running', () => {
        beforeEach((done) => {
            serverlessProjectUtils.commands.proxy.lifecycleEvents.forEach(e => {
                serverlessProjectUtils.hooks[`proxy:${e}`]();
            });
            done();
        });

        describe('when a debug value in a serverless config file is changed', () => {
            const puppiesConfigPath = path.join(__dirname, './puppies/serverless.yml');
            const fileContents = fs.readFileSync(puppiesConfigPath).toString();
            before((done) => {
                fs.writeFile(puppiesConfigPath, fileContents.replace(/debug: true/gi, ''), () => done());
            });

            after((done) => {
                fs.writeFile(puppiesConfigPath, fileContents, () => done());
            });

            it('should store the updated routes for puppies and kittens', () => {
                return serverlessProjectUtils.loadRoutesPromise.then(() => {

                    const get = serverlessProjectUtils.routesByHttpMethod.GET;

                    const getKitten = get[1];
                    assert.equal(getKitten.path, 'kittens/{kittenId}');
                    assert.equal(getKitten.port, ports.kittens);
                    assert.equal(getKitten.debug, false);


                    const getPuppy = get[2];
                    assert.equal(getPuppy.path, 'puppies/{puppyId}');
                    assert.equal(getPuppy.port, ports.puppies);
                    assert.equal(getPuppy.debug, false);
                });
            });

            it('should proxy puppies to default', () => {
                return Promise.all([
                    sendHttpGetRequest('/puppies/22').then(result => {
                        assert.equal(result.status, 200);
                        return result.json().then(body => {
                            assert.equal(body.server, 'default');
                        });
                    })
                ]);
            });
        });
    });
});