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
	chai = require('chai'),
	chaiAsPromised = require('chai-as-promised'),
	sinonChai = require('sinon-chai'),
	sinon = require('sinon'),
	redis = require('redis'),

	configValidator = require(root + '/src/lib/index/shared/configValidator'),

	mocks = {},

	sandbox = sinon.sandbox.create(),
	expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('index/shared/redis.js', () => {

	let RedisService;

	beforeEach(() => {
		sandbox.stub(configValidator, 'validate').returns(undefined);
		mocks.action = sandbox.stub();
		mocks.connection = {
			quit: sandbox.stub()
		};
		mocks.redis = {
			createClient: sandbox.stub(redis, 'createClient').returns(mocks.connection)
		};
		mocks.config = {
			url: 'test'
		};
		RedisService = require(root + '/src/lib/index/shared/redis');
	});

	afterEach(() => {
		const redisServicePath = require.resolve(root + '/src/lib/index/shared/redis');
		delete require.cache[redisServicePath];
		sandbox.restore();
	});

	describe('apply', () => {

		describe('should handle error', () => {

			it('from redis.createClient', () => {
				// given
				mocks.redis.createClient.throws(new Error('bad'));

				// when
				return expect(RedisService.apply(mocks.action, mocks.config))
					.to.eventually.be.rejectedWith('bad')
					// then
					.then(() => {
						expect(mocks.redis.createClient).to.have.been.calledOnce;
						expect(mocks.redis.createClient).to.have.been.calledWith(mocks.config);
						expect(mocks.connection.createChannel).to.have.been.notCalled;
						expect(mocks.action).to.have.been.notCalled;
					});
			});

			it('from action', () => {
				// given
				mocks.action.rejects(new Error('bad'));

				// when
				return expect(RedisService.apply(mocks.action, mocks.config))
					.to.eventually.be.rejectedWith('bad')
					// then
					.then(() => {
						expect(mocks.redis.createClient).to.have.been.calledOnce;
						expect(mocks.redis.createClient).to.have.been.calledWith(mocks.config);
						expect(mocks.action).to.have.been.calledOnce;
						expect(mocks.action).to.have.been.calledWith(mocks.connection);
						expect(mocks.connection.quit).to.have.been.calledOnce;
					});
			});

		});

		it('should invoke the action', () => {
			// given/when
			return expect(RedisService.apply(mocks.action, mocks.config))
				.to.eventually.be.fulfilled
				// then
				.then(() => {
					expect(mocks.redis.createClient).to.have.been.calledOnce;
					expect(mocks.redis.createClient).to.have.been.calledWith(mocks.config);
					expect(mocks.action).to.have.been.calledOnce;
					expect(mocks.action).to.have.been.calledWith(mocks.connection);
				});
		});

		it('should lazy load the connection', () => {
			// given/when
			return expect(RedisService.apply(mocks.action, mocks.config).then(() => RedisService.apply(mocks.action, mocks.config)))
				.to.eventually.be.fulfilled
				// then
				.then(() => {
					expect(mocks.redis.createClient).to.have.been.calledOnce;
					expect(mocks.redis.createClient).to.have.been.calledWith(mocks.config);
					expect(mocks.action).to.have.been.calledTwice;
					expect(mocks.action).to.have.been.calledWith(mocks.connection);
				});
		});

	});

});
