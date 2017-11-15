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
	sinonChai = require('sinon-chai'),
	chaiAsPromised = require('chai-as-promised'),
	sinon = require('sinon'),

	mocks = {},

	sandbox = sinon.sandbox.create(),
	expect = chai.expect,
	anyFunction = sinon.match.func;

chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('index/subscribe.js', () => {

	let Subscriber;

	beforeEach(() => {
		mocks.redis = {
			subscribe: sandbox.stub().resolves()
		};
		mocks.handler = sandbox.stub();

		Subscriber = proxyquire(root + '/src/lib/index/subscribe', {
			['./shared/redis']: mocks.redis
		});
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('subscribe', () => {

		it('should call the underlying subscribe', () => {

			// given
			const
				topic = 'TestTopic',
				config = { path: 'test' };

			mocks.redis.subscribe.resolves();
			mocks.handler.resolves();

			// when
			return Subscriber.subscribe({ eventName: topic, handler: mocks.handler, config })
				// then
				.then(() => {
					expect(mocks.redis.subscribe).to.have.been.calledOnce;
					expect(mocks.redis.subscribe).to.have.been.calledWith(topic, anyFunction, config);
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
				mocks.redis.subscribe.rejects(new Error('Fail'));

				// when - then
				return expect(Subscriber.subscribe({})).to.be.rejectedWith('Fail');

			});

			it('if handler function throws an error', () => {

				// given
				const
					message = 'Test';

				mocks.handler.throws(new Error('test error'));

				// when
				Subscriber.wrapper(mocks.handler)(message);

				// when
				return expect(Subscriber.wrapper(mocks.handler)(message)).to.be.rejectedWith('test error')
					.then(() => {

						// then
						expect(errorEvents).to.include('test error');

					});

			});

			it('if handler function rejects', () => {

				// given
				const
					message = 'Test';

				mocks.handler.rejects(new Error('test error'));

				// when
				return expect(Subscriber.wrapper(mocks.handler)(message)).to.be.rejectedWith('test error')
					.then(() => {

						// then
						expect(errorEvents).to.include('test error');

					});


			});

		});

	});

});
