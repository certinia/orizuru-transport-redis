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

	LIST_ITEM_OFFSET = 1,

	_ = require('lodash'),
	redis = require('redis'),

	validateConfiguration = require('./configValidator').validate,

	redisInstances = new Map(),

	overrideConfiguration = (config) => {
		const newConfig = {};

		Object.assign(newConfig, {
			['return_buffers']: true
		}, config);

		return newConfig;
	},

	validateHandler = (handler) => () => {
		if (!_.isFunction(handler)) {
			throw new Error('Handler is not a Function.');
		}
	},

	getOrCreateRedisInstance = (config) => {
		let redisInstance = redisInstances.get(config.url);

		if (!redisInstance) {
			redisInstance = {};
			redisInstances.set(config.url, redisInstance);
		}

		return redisInstance;
	},

	getPublishingConnection = (config) => () => {

		const redisInstance = getOrCreateRedisInstance(config);

		if (!redisInstance.publishingConnection) {
			redisInstance.publishingConnection = redis.createClient(overrideConfiguration(config));
		}

		return redisInstance.publishingConnection;
	},

	getSubscribingConnection = (config) => () => {

		const redisInstance = getOrCreateRedisInstance(config);

		if (!redisInstance.subscribingConnection) {
			redisInstance.subscribingConnection = redis.createClient(overrideConfiguration(config));
		}

		return redisInstance.subscribingConnection;
	},

	publishMessage = (channel, buffer) => (connection) => {
		/*
		 * List push.
		 */
		connection.lpush(channel, buffer);
		return true;
	},

	subscribeHandler = (channel, handler, config) => (connection) => {

		const processMessage = () => {

			/*
			 * Blocking list pop.
			 */
			connection.blpop(channel, 0, (err, data) => {
				if (err) {
					throw err;
				}
				/*
				 * Data is an array with the first element being the
				 * key and the second being the item popped from the
				 * list.
				 */
				handler(data[LIST_ITEM_OFFSET]);
				processMessage();
			});

		};

		return new Promise((resolve, reject) => {

			try {
				processMessage();
			} catch (error) {
				reject(error);
			}

			resolve(true);
		});

	};

module.exports = {

	publish: (channel, buffer, config) => {
		return Promise.resolve(config)
			.then(validateConfiguration)
			.then(getPublishingConnection(config))
			.then(publishMessage(channel, buffer));
	},

	subscribe: (channel, handler, config) => {
		return Promise.resolve(config)
			.then(validateConfiguration)
			.then(validateHandler(handler))
			.then(getSubscribingConnection(config))
			.then(subscribeHandler(channel, handler, config));
	}

};
