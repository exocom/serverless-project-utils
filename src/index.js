'use strict';

const http = require('http');
const httpProxy = require('http-proxy');
const gulp = require('gulp');
const vinylYamlData = require('vinyl-yaml-data');
const streamToPromise = require('stream-to-promise');
const pathToRegexp = require('path-to-regexp');
const promisify = require('util').promisify;
const through2 = require('through2');

const isPortInUse = promisify(function (port, fn) {
    const net = require('net');

    const testServer = net.createServer()
        .once('error', (err) => {
            if (err.code !== 'EADDRINUSE') return fn(err);
            fn(null, true)
        })
        .once('listening', function () {
            testServer.once('close', () => {
                fn(null, false)
            }).close()
        })
        .listen(port)
});


class ServerlessProjectUtils {
    constructor(serverless, options) {
        this.loading = {
            routes: false
        };

        this.loadRoutesPromise = null;


        this.serverless = serverless;
        this.options = Object.assign({}, options, {
            port: 5000,
            paths: {
                serverless: ['**/serverless.yml', '**/src/serverless.yml']
            }
        });

        this.commands = {
            proxy: {
                usage: 'Checks to see if the AWS API gateway exists and if you have permission',
                lifecycleEvents: ['loadRoutes', 'startProxyServer']
            }
        };

        this.hooks = {
            'proxy:loadRoutes': this.loadRoutes.bind(this),
            'proxy:startProxyServer': this.startProxyServer.bind(this)
        };

        this.routesByHttpMethod = this.defaultPaths();
    }

    defaultPaths() {
        return {
            GET: [],
            HEAD: [],
            POST: [],
            PUT: [],
            DELETE: [],
            CONNECT: [],
            OPTIONS: []
        };
    }

    addPath(method, path, port, debug = false) {
        let routes = this.routesByHttpMethod[method];
        let route = routes.find(r => r.path === path);
        if (!route) {
            routes.push({path, port, debug});
        }
    }

    loadRoutes() {
        if (this.loading.routes) return;

        this.loading.routes = true;
        this.routesByHttpMethod = this.defaultPaths();

        let _this = this;
        let stream = gulp.src(this.options.paths.serverless, {base: this.serverless.config.servicePath})
            .pipe(vinylYamlData())
            .pipe(through2.obj(function (obj, enc, cb) {
                let key = Object.keys(obj)[0];
                let data = obj[key].src ? obj[key].src.serverless : obj[key].serverless;

                if (data && data.custom && data.custom.localDevPort) {
                    // TODO : detect the local host plugin and store prefix as '/http'.
                    // TODO : allow custom: localDevPathPrefix to set prefix.

                    Object.values(data.functions).forEach(f => {
                        if (f.events) {
                            f.events.forEach(e => {
                                if (e.http && e.http.method && e.http.path) {
                                    const method = e.http.method.toUpperCase();
                                    const path = e.http.path;
                                    const port = data.custom.localDevPort;
                                    const debug = data.custom.debug;
                                    _this.addPath(method, path, port, debug);
                                }
                            });
                        }
                    });
                }

                this.push(obj);
                cb();
            }));

        this.loadRoutesPromise = streamToPromise(stream).then((data) => {
            this.loading.routes = false;
            return data;
        });
    }

    startProxyServer() {
        this.proxy = httpProxy.createProxyServer({});

        this.proxy.on('error', (err, req, res) => {
            if (res) {
                res.status(500);
                res.end(JSON.stringify({message: 'Unable to proxy request', error: err}));
            }
        });

        this.server = http.createServer(async (req, res) => {
            if (this.loading.routes) await this.loadRoutesPromise;

            const routes = this.routesByHttpMethod[req.method] || [];
            const route = routes.find(r => {
                const path = r.path.replace(/\{(.*?)\}/g, ':$1');
                return pathToRegexp(path).test(req.url.replace(/^\//, ''));
            });

            /*
            * NOTE: This plugin could use isPortInUse instead of route.debug.
            * however to be explicit the `debug: true` must be present in the serverless yaml at this time
             */
            if (route && route.debug) {
                let readyForRequest = route.port ? await isPortInUse(route.port) : false;
                if (readyForRequest) {
                    this.proxy.web(req, res, {target: `http://localhost:${route.port}`});
                    return;
                }
            }

            this.proxy.web(req, res, {target: this.options.target});
        });

        console.log(`listening on port ${this.options.port}`);
        this.server.listen(this.options.port);
    }
}

module.exports = ServerlessProjectUtils;