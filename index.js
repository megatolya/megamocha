'use strict';

const request = require('supertest');
const _ = require('lodash');
const express = require('express');
const {all: clearRequireCache} = require('clear-require');

const appsDeclarations = [];

module.exports = (name, create) => {
    appsDeclarations.push({name, create});

    return {
        // params
        //   method
        //   middleware
        //   query
        //   body
        run(path, params) {
            const options = _.defaults({
                method: 'get'
            }, params);
            const backends = {};
            const apps = {};

            clearRequireCache();

            const gens = appsDeclarations.map(({name: appName, create: createApp}) => {
                apps[appName] = express();
                const gen = createApp(apps[appName]);
                const {value: exportedApps} = gen.next();

                Object.assign(backends, exportedApps);

                return gen;
            });

            clearRequireCache();

            if (options.middlewares) {
                options.middlewares(backends);
            }

            Object.keys(backends).forEach(backendName => {
                const backend = backends[backendName];
                backend.use((err, req, res, next) => {
                    if (err === 'skip-middleware') {
                        next();
                    } else {
                        next(err);
                    }
                });
            });

            clearRequireCache();

            gens.forEach(gen => gen.next());

            clearRequireCache();

            return new Promise((resolve, reject) => {
                const req = request(apps[options.backend])[options.method](path);

                if (options.body) {
                    req.send(options.body);
                }

                if (options.query) {
                    req.query(options.query);
                }

                req.end((err, res) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                });
            });
        }
    };
};
