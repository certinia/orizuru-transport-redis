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
	sinon = require('sinon'),
	chaiAsPromised = require('chai-as-promised'),

	Redis = require(root + '/src/lib/index/shared/redis'),

	Publisher = require(root + '/src/lib/index/publish'),

	mocks = {},
	anyFunction = sinon.match.func,

	sandbox = sinon.sandbox.create(),
	expect = chai.expect;

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('index/publish.js', () => {

	beforeEach(() => {
		mocks.Redis = {
			apply: sandbox.stub(Redis, 'apply')
		};
		mocks.connection = {
			publish: sandbox.stub()
		};
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

			mocks.Redis.apply.callsFake(action => {
				return Promise.resolve(action(mocks.connection));
			});

			// when
			return Publisher
				.send({
					eventName,
					buffer,
					config
				})
				// then
				.then(() => {
					expect(mocks.Redis.apply).to.have.been.calledOnce;
					expect(mocks.Redis.apply).to.have.been.calledWith(anyFunction, config);
					expect(mocks.connection.publish).to.be.calledOnce;
					expect(mocks.connection.publish).to.be.calledWith(eventName, buffer);
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
				mocks.Redis.apply.callsFake(action => {
					return Promise.reject(new Error('test error'));
				});

				// when - then
				return expect(Publisher.send({})).to.be.rejected.then(() => {
					expect(errorEvents).to.include('test error');
				});

			});

		});

	});

});
