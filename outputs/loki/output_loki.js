var abstract_http = require('./abstract_http'),
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var recordCache = require('record-cache');

var cache;

function LokiPost() {
  abstract_http.AbstractHttp.call(this);
  this.mergeConfig(this.serializer_config('raw'));
  this.mergeConfig({
    name: 'Loki',
    optional_params: ['path', 'maxSize', 'maxAge'],
    default_values: {
      'path': '/',
      'maxSize': 5000,
      'maxAge': 1000,
    },
    start_hook: this.start,
  });
}

LokiPost.prototype.start = function(callback) {
  /* Bulk Helper */
  this.onStale = function(data){
        for (let [key, value] of data.records.entries()) {
             if(!value.list[0]) return;
             var line = {"streams": [{"labels": "", "entries": [] }]};
             line.streams[0].labels="__filename__=\""+key+"\""
             value.list.forEach(function(row){
                // add to array
                row = row.record;
                line.streams[0].entries.push({ "ts": row['@timestamp']||new Date().toISOString(), "line": row.message  });
             });
             line = JSON.stringify(line);
             var path = this.replaceByFields(data, this.path);
                if (path) {
                  var http_options = {
                    port: this.port,
                    path: path,
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  };
                  if (line) {
                    http_options.headers['Content-Length'] = Buffer.byteLength(line, 'utf-8');
                    if ( typeof this.host !== 'string' ) {
                      for (var i = 0, len = this.host.length; i < len; i++){
                         http_options.host = this.host[i];
                         this.sendHttpRequest(http_options, line);
                      }
                    } else {
                         http_options.host = this.host;
                         this.sendHttpRequest(http_options, line);
                    }
                  }
                }
        }
  }.bind(this)

  this.cache = recordCache({
          maxSize: this.maxSize,
          maxAge: this.maxAge,
          onStale: this.onStale
  })
  cache = this.cache;

  callback();
};

util.inherits(LokiPost, abstract_http.AbstractHttp);

LokiPost.prototype.process = function(data) {
        cache.add(data.path,data);
};

LokiPost.prototype.to = function() {
  return ' LOKI http ' + this.host + ':' + this.port + '' + this.path;
};

exports.create = function() {
  return new LokiPost();
};
