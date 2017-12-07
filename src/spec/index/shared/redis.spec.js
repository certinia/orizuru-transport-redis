/**
 * Copyright (c) 2017, FinancialForce.com, inc
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, 
 *   are permitted provided that the following conditions are met:
 *
 * - Redistributions of source code must retain the above copyright notice, 
 *      this list of conditions and the following disclaimer.
 * - Redistributions in binary form must reproduce the above copyright notice, 
 *      this list of conditions and the following disclaimer in the documentation 
 *      and/or other materials provided with the distribution.
 * - Neither the name of the FinancialForce.com, inc nor the names of its contributors 
 *      may be used to endorse or promote products derived from this software without 
 *      specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND 
 *  ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES 
 *  OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL 
 *  THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, 
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 *  OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 *  OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 **/

'use strict';

const

	root = require('app-root-path'),

	proxyquire = require('proxyquire'),

	chai = require('chai'),
	chaiAsPromised = require('chai-as-promised'),
	sinonChai = require('sinon-chai'),
	sinon = require('sinon'),
	{ calledOnce, calledTwice, notCalled, calledWith } = sinon.assert,

	configValidator = require(root + '/src/lib/index/shared/configValidator'),

	mocks = {},

	sandbox = sinon.sandbox.create();

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('index/shared/redis.js', () => {

	let redis, config, overriddenConfig;

	beforeEach(() => {
		sandbox.stub(configValidator, 'validate').returns(undefined);
		mocks.connection = {
			lpush: sandbox.stub(),
			blpop: sandbox.stub(),
			quit: sandbox.stub()
		};
		mocks.redis = {
			createClient: sandbox.stub().returns(mocks.connection)
		};
		mocks.config = {
			url: 'test'
		};
		redis = proxyquire(root + '/src/lib/index/shared/redis', {
			['redis']: mocks.redis
		});
		config = {
			url: 'redis://bigserver.com:1234'
		};
		overriddenConfig = {
			url: 'redis://bigserver.com:1234',
			['return_buffers']: true
		};
	});

	afterEach(() => {
		const redisServicePath = require.resolve(root + '/src/lib/index/shared/redis');
		delete require.cache[redisServicePath];
		sandbox.restore();
	});

	describe('publish', () => {

		it('should create a new connection and call publish on it', () => {

			// given

			const
				channel = 'really_useful',
				buffer = {};

			// when

			return redis.publish(channel, buffer, config).should.be.fulfilled
				.then(() => {

					// then

					calledOnce(mocks.redis.createClient);
					calledWith(mocks.redis.createClient, overriddenConfig);
					calledOnce(mocks.connection.lpush);
					calledWith(mocks.connection.lpush, channel, buffer);
					notCalled(mocks.connection.quit);
				});

		});

		it('should reject if createClient fails', () => {

			// given

			const
				channel = 'really_useful',
				buffer = {};

			mocks.redis.createClient.throws(new Error('Bad'));

			// when

			return redis.publish(channel, buffer, config).should.be.rejectedWith('Bad')
				.then(() => {
					// then

					calledOnce(mocks.redis.createClient);
					calledWith(mocks.redis.createClient, overriddenConfig);
					notCalled(mocks.connection.lpush);
					notCalled(mocks.connection.quit);
				});

		});

		it('should reject if lpush fails', () => {

			// given

			const
				channel = 'really_useful',
				buffer = {};

			mocks.connection.lpush.throws(new Error('Fail'));

			// when

			return redis.publish(channel, buffer, config).should.be.rejectedWith('Fail')
				.then(() => {
					// then

					calledOnce(mocks.redis.createClient);
					calledWith(mocks.redis.createClient, overriddenConfig);
					calledOnce(mocks.connection.lpush);
					calledWith(mocks.connection.lpush, channel, buffer);
				});

		});

		it('should reuse an existing connection', () => {

			// given

			const
				channel = 'really_useful',
				buffer = {};

			// when

			return redis.publish(channel, buffer, config).should.be.fulfilled
				.then(() => redis.publish(channel, buffer, config).should.be.fulfilled)
				.then(() => {
					// then

					calledOnce(mocks.redis.createClient);
					calledWith(mocks.redis.createClient, overriddenConfig);
					calledTwice(mocks.connection.lpush);
					calledWith(mocks.connection.lpush, channel, buffer);
					calledWith(mocks.connection.lpush, channel, buffer);
					notCalled(mocks.connection.quit);
				});

		});

	});

	describe('subscribe', () => {

		it('should reject an invalid handler', () => {

			// given

			const
				channelA = 'a';

			// when

			return redis.subscribe(channelA, {}, config).should.be.rejectedWith('Handler is not a Function.')
				.then(() => {

					// then

					notCalled(mocks.redis.createClient);
					notCalled(mocks.connection.blpop);
					notCalled(mocks.connection.quit);
				});

		});

		it('should call on message buffer and subscribe for first subscribe', () => {

			// given

			const
				channel = 'really_useful',
				handler = sandbox.stub();

			// when

			return redis.subscribe(channel, handler, config).should.be.fulfilled
				.then(() => {

					// then

					calledOnce(mocks.redis.createClient);
					calledWith(mocks.redis.createClient, overriddenConfig);
					calledOnce(mocks.connection.blpop);
					calledWith(mocks.connection.blpop, channel);
					notCalled(mocks.connection.quit);
				});

		});

		it('should reject on failure of createClient', () => {

			// given

			const
				channel = 'really_useful',
				handler = sandbox.stub();

			mocks.redis.createClient.throws(new Error('Fail'));

			// when

			return redis.subscribe(channel, handler, config).should.be.rejectedWith('Fail')
				.then(() => {

					// then

					calledOnce(mocks.redis.createClient);
					calledWith(mocks.redis.createClient, overriddenConfig);
					notCalled(mocks.connection.blpop);
					notCalled(mocks.connection.quit);
				});

		});

		it('should reject on failure of blpop call', () => {

			// given

			const
				channel = 'really_useful',
				handler = sandbox.stub();

			mocks.connection.blpop.yields(new Error('Fail'), null);

			// when

			return redis.subscribe(channel, handler, config).should.be.rejectedWith('Fail')
				.then(() => {

					// then

					calledOnce(mocks.redis.createClient);
					calledWith(mocks.redis.createClient, overriddenConfig);
					calledOnce(mocks.connection.blpop);
					calledWith(mocks.connection.blpop, channel);
				});

		});

		it('should call registered handler when new messages arrive', () => {

			// given

			const
				channelA = 'a',
				channelB = 'b',
				handlerA = sandbox.stub(),
				handlerB = sandbox.stub(),
				messageA = Buffer.from('A'),
				messageB = Buffer.from('B');

			mocks.connection.blpop
				.onFirstCall().yields(null, [channelA, messageA])
				.onThirdCall().yields(null, [channelB, messageB]);

			return redis.subscribe(channelA, handlerA, config).should.be.fulfilled
				.then(() => redis.subscribe(channelB, handlerB, config).should.be.fulfilled)
				.then(() => {

					// when
					// then

					calledOnce(handlerA);
					calledWith(handlerA, messageA);
					calledOnce(handlerB);
					calledWith(handlerB, messageB);
				});

		});

	});

});
