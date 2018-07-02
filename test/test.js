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
        beforeEach(() => {
            serverless.processedInput = {
                commands: ['export'],
                options: {stage: undefined, region: undefined}
            };
            return serverless.run();
        });

        it('should create a serverless.json', () => {
            assert.isTrue(fs.existsSync(`${serverlessFolder}/serverless.json`));
            const serverlessYaml = require(`${serverlessFolder}/serverless.json`);

            assert.equal(serverlessYaml.serviceObject.name, 'panda');
            assert.equal(serverlessYaml.provider.environment.NODE_ENV, 'dev');
            assert.equal(serverlessYaml.provider.environment.SERVICE_NAME, 'panda');

            assert.equal(serverlessYaml.functions.create.environment.NODE_ENV, 'test');
        });
    });
});