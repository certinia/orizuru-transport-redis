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
	sinon = require('sinon'),
	chaiAsPromised = require('chai-as-promised'),

	mocks = {},

	sandbox = sinon.sandbox.create(),
	expect = chai.expect;

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('index/publish.js', () => {

	let Publisher;

	beforeEach(() => {
		mocks.redis = {
			publish: sandbox.stub().resolves()
		};

		Publisher = proxyquire(root + '/src/lib/index/publish', {
			['./shared/redis']: mocks.redis
		});
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('send', () => {

		it('should call publish', () => {

			// given
			const
				eventName = 'TestTopic',
				buffer = 'TestBuffer',
				config = 'test';

			// when
			return Publisher
				.publish({
					eventName,
					buffer,
					config
				})
				// then
				.then(() => {
					expect(mocks.redis.publish).to.have.been.calledOnce;
					expect(mocks.redis.publish).to.have.been.calledWith(eventName, buffer, config);
				});
		});

	});

	describe('emitter', () => {

		let errorEvents = [];

		const listener = message => {
			errorEvents.push(message);
		};

		beforeEach(() => {
			Publisher.emitter.addListener(Publisher.emitter.ERROR, listener);
		});

		afterEach(() => {
			Publisher.emitter.removeListener(Publisher.emitter.ERROR, listener);
			errorEvents = [];
		});

		describe('should emit an error event', () => {

			it('if publish throws an error', () => {

				// given
				mocks.redis.publish.rejects(new Error('test error'));

				// when - then
				return expect(Publisher.publish({})).to.be.rejected.then(() => {
					expect(errorEvents).to.include('test error');
				});

			});

		});

	});

});
