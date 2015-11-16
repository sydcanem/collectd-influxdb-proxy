#!/usr/bin/env node
'use strict';

var http = require('http'),
    querystring = require('querystring'),
    argv = require('optimist').argv;

function usage() {
  console.log('node proxy.js [options]');
  console.log('options :');
  console.log('  --proxy_http_port port : proxy http port, default value 8079');
  console.log('  --proxy_http_address address : proxy http address, default value 0.0.0.0');
  console.log('  --influxdb_host : influxdb host, default value localhost');
  console.log('  --influxdb_port : influxdb port, default value 8086');
  console.log('  --influxdb_db : influxdb db');
  console.log('  --influxdb_user : influxdb user');
  console.log('  --influxdb_password : influxdb password');
  console.log('  --verbose : display metric name pushed into influxdb');
  console.log('  --help : this help');
  process.exit(1);
}

if (argv.help) {
  usage();
}

if (!argv.proxy_http_port) {
  argv.proxy_http_port = 25826;
}

if (!argv.proxy_http_address) {
  argv.proxy_http_address = '0.0.0.0';
}

if (!argv.influxdb_host) {
  argv.influxdb_host = 'localhost';
}

if (!argv.influxdb_port) {
  argv.influxdb_port = '8086';
}

if (!argv.influxdb_db) {
  console.log('Missing param : influxdb_db');
  usage();
}

if (!argv.influxdb_user) {
  console.log('Missing param : influxdb_user');
  usage();
}

if (!argv.influxdb_password) {
  console.log('Missing param : influxdb_password');
  usage();
}

argv.influxdb_path = '/write?u=' + argv.influxdb_user + '&p=' + argv.influxdb_password + '&db=' + argv.influxdb_db;

console.log('Host :', argv.influxdb_host, ':', argv.influxdb_port);
console.log('Path :', argv.influxdb_path);

var server = http.createServer(function(req, res) {
  var data = '';
  req.on('data', function(chunk) {
    data += chunk.toString();
  });
  req.on('end', function() {
    res.writeHead(200);
    res.end();

    var output = [];
    var parsed = JSON.parse(data);

    var lines = '';
    parsed.forEach(function(x) {
      var metric = x.plugin;
      if (x.plugin_instance !== '') {
        metric = metric + '.' + x.plugin_instance;
      }
      metric = metric + '.' + x.type;
      if (x.type_instance !== '') {
        metric = metric + '.' + x.type_instance;
      }
      for (var z in x.dstypes) {
        if (x.dstypes[z] == 'counter' || x.dstypes[z] == 'gauge' || x.dstypes[z] == 'derive') {
          var n = metric + '.' + x.dsnames[z] + ',host=' + x.host;
          var l = n + ' value=' + x.values[z];
          lines += l + '\n';
        }
      }
    });

    if (argv.verbose) {
      console.log('Push metrics:\n', lines);
    }

    var forwarded_req = {
      hostname: argv.influxdb_host,
      port: argv.influxdb_port,
      path: argv.influxdb_path,
      method: 'POST',
      agent: false
    };

    var req = http.request(forwarded_req, function(rr) {
      if (rr.statusCode >= 400) {
        console.error('Request refused by influx db', rr.statusCode);
      }
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    req.write(lines);
    req.end();
  });
});

server.listen(argv.proxy_http_port, argv.proxy_http_address);

console.log('Proxy started on port', argv.proxy_http_port, 'ip', argv.proxy_http_address);

