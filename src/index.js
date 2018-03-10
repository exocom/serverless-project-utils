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
        let _this = this;
        this.routesByHttpMethod = this.defaultPaths();

        let stream = gulp.src(this.options.paths.serverless, {base: this.serverless.config.servicePath})
            .pipe(vinylYamlData())
            .pipe(through2.obj(function (obj, enc, cb) {
                let key = Object.keys(obj)[0];
                let data = obj[key].src ? obj[key].src.serverless : obj[key].serverless;

                if (data && data.custom && data.custom.localDevPort) {
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

        return streamToPromise(stream);
    }

    startProxyServer() {
        this.proxy = httpProxy.createProxyServer({});

        this.proxy.on('error', (err, req, res) => {
            res.writeHead(500, {
                'Content-Type': 'text/plain'
            });

            res.end('Something went wrong. And we are reporting a custom error message.');
        });

        this.server = http.createServer(async (req, res) => {
            const routes = this.routesByHttpMethod[req.method] || [];
            const route = routes.find(r => {
                const path = r.path.replace(/\{(.*?)\}/g, ':$1');
                return pathToRegexp(path).test(req.url);
            });

            if (route) {
                let readyForRequest = route.debug || (route.port ? await isPortInUse(route.port) : false);
                if (readyForRequest) {
                    console.log(routes[key].target);
                    this.proxy.web(req, res, {target: route.target});
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