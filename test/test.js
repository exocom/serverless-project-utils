'use strict';

/* global describe it beforeEach afterEach */
const fs = require('fs');
const path = require('path');
const chai = require('chai');
const sinon = require('sinon');
const Serverless = require('serverless');
const ServerlessProjectUtils = require('../src');


const assert = chai.assert;
const serverlessFolder = path.join(__dirname, '.serverless');

describe('index.js', () => {

    let sandbox;
    let serverless;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        serverless = new Serverless({servicePath: __dirname});

        return serverless.init()
            .then(() => {
                serverless.pluginManager.addPlugin(ServerlessProjectUtils);
            });
    });

    afterEach((done) => {
        sandbox.restore();
        done();
    });

    describe('when export command is ran', () => {
        beforeEach((done) => {
            serverless.processedInput = {
                commands: ['export'],
                options: {stage: undefined, region: undefined}
            };
            serverless.run();
            done();
        });

        it('should create an environment.json', () => {
            assert.isTrue(fs.existsSync(`${serverlessFolder}/environment.json`));
            const env = require(`${serverlessFolder}/environment.json`);

            assert.equal(env.NODE_ENV, 'dev');
            assert.equal(env.SERVICE_NAME, 'panda');
        });
    });
});