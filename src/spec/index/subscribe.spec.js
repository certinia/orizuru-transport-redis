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
	sinonChai = require('sinon-chai'),
	chaiAsPromised = require('chai-as-promised'),
	sinon = require('sinon'),

	Redis = require(root + '/src/lib/index/shared/redis'),

	Subscriber = require(root + '/src/lib/index/subscribe'),

	mocks = {},

	sandbox = sinon.sandbox.create(),
	expect = chai.expect,
	anyFunction = sinon.match.func;

chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('index/subscribe.js', () => {

	beforeEach(() => {
		mocks.Redis = {
			apply: sandbox.stub(Redis, 'apply')
		};
		mocks.connection = {
			on: sandbox.stub(),
			subscribe: sandbox.stub()
		};
		mocks.handler = sandbox.stub();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('subscribe', () => {

		it('should supply messages to the handler', () => {

			// given
			const
				topic = 'TestTopic',
				message = 'TestMessage',
				config = { path: 'test' };

			mocks.connection.on.callsFake((type, callback) => {
				return callback(topic, message);
			});
			mocks.handler.resolves();
			mocks.Redis.apply.callsFake(action => {
				return Promise.resolve(action(mocks.connection));
			});

			// when
			return Subscriber.handle({ eventName: topic, handler: mocks.handler, config })
				// then
				.then(() => {
					expect(mocks.Redis.apply).to.have.been.calledOnce;
					expect(mocks.Redis.apply).to.have.been.calledWith(anyFunction, config);
					expect(mocks.connection.on).to.have.been.calledOnce;
					expect(mocks.connection.on).to.have.been.calledWith('messageBuffer', anyFunction);
					expect(mocks.connection.subscribe).to.have.been.calledOnce;
					expect(mocks.connection.subscribe).to.have.been.calledWith(topic);
					expect(mocks.handler).to.have.been.calledOnce;
					expect(mocks.handler).to.have.been.calledWith(message);
				});
		});

		it('should swallow handler errors when a returned promise rejects', () => {

			// given
			const
				topic = 'TestTopic',
				message = {
					content: 'TestMessage'
				};

			mocks.connection.on.callsFake((type, callback) => {
				return callback(topic, message);
			});
			mocks.handler.rejects(new Error('test'));
			mocks.Redis.apply.callsFake(action => {
				return Promise.resolve(action(mocks.connection));
			});

			// when
			return expect(Subscriber.handle({ eventName: topic, handler: mocks.handler })).to.be.fulfilled
				// then
				.then(() => {
					expect(mocks.Redis.apply).to.have.been.calledOnce;
					expect(mocks.Redis.apply).to.have.been.calledWith(anyFunction);
					expect(mocks.connection.on).to.have.been.calledOnce;
					expect(mocks.connection.on).to.have.been.calledWith('messageBuffer', anyFunction);
					expect(mocks.connection.subscribe).to.have.been.calledOnce;
					expect(mocks.connection.subscribe).to.have.been.calledWith(topic);
					expect(mocks.handler).to.have.been.calledOnce;
					expect(mocks.handler).to.have.been.calledWith(message);
				});
		});

		it('should swallow handler errors when an error is thrown', () => {

			// given
			const
				topic = 'TestTopic',
				message = {
					content: 'TestMessage'
				};

			mocks.connection.on.callsFake((type, callback) => {
				return callback(topic, message);
			});
			mocks.handler.throws(new Error('test'));
			mocks.Redis.apply.callsFake(action => {
				return Promise.resolve(action(mocks.connection));
			});

			// when
			return expect(Subscriber.handle({ eventName: topic, handler: mocks.handler })).to.be.fulfilled
				// then
				.then(() => {
					expect(mocks.Redis.apply).to.have.been.calledOnce;
					expect(mocks.Redis.apply).to.have.been.calledWith(anyFunction);
					expect(mocks.connection.subscribe).to.have.been.calledOnce;
					expect(mocks.connection.subscribe).to.have.been.calledWith(topic);
					expect(mocks.connection.on).to.have.been.calledOnce;
					expect(mocks.connection.on).to.have.been.calledWith('messageBuffer', anyFunction);
					expect(mocks.handler).to.have.been.calledOnce;
					expect(mocks.handler).to.have.been.calledWith(message);
				});
		});

	});

	describe('emitter', () => {

		let errorEvents = [];

		const listener = message => {
			errorEvents.push(message);
		};

		beforeEach(() => {
			Subscriber.emitter.addListener(Subscriber.emitter.ERROR, listener);
		});

		afterEach(() => {
			Subscriber.emitter.removeListener(Subscriber.emitter.ERROR, listener);
			errorEvents = [];
		});

		describe('should emit an error event', () => {

			it('if subscribe throws an error', () => {

				// given
				mocks.Redis.apply.callsFake(action => {
					return Promise.reject(new Error('test error'));
				});

				// when - then
				return expect(Subscriber.handle({})).to.be.rejected.then(() => {
					expect(errorEvents).to.include('test error');
				});

			});

			it('if handler function throws an error', () => {

				// given
				const
					topic = 'TestTopic',
					message = {
						content: 'TestMessage'
					};

				mocks.connection.on.callsFake((type, callback) => {
					return callback(topic, message);
				});
				mocks.handler.throws(new Error('test error'));
				mocks.Redis.apply.callsFake(action => {
					return Promise.resolve(action(mocks.connection));
				});

				// when
				return expect(Subscriber.handle({ eventName: topic, handler: mocks.handler })).to.be.fulfilled
					// then
					.then(() => {
						expect(errorEvents).to.include('test error');
					});

			});

			it('if handler function rejects', () => {

				// given
				const
					topic = 'TestTopic',
					message = {
						content: 'TestMessage'
					};

				mocks.connection.on.callsFake((type, callback) => {
					return callback(topic, message);
				});
				mocks.handler.rejects(new Error('test error'));
				mocks.Redis.apply.callsFake(action => {
					return Promise.resolve(action(mocks.connection));
				});

				// when
				return expect(Subscriber.handle({ eventName: topic, handler: mocks.handler })).to.be.fulfilled
					// then
					.then(() => {
						expect(errorEvents).to.include('test error');
					});

			});

		});

	});

});
