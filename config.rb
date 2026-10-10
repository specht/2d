#!/usr/bin/env ruby

require 'fileutils'
require 'json'
require 'yaml'
require './env.rb'

DEV_NGINX_PORT = DEVELOPMENT ? 8025 : 8020
# The most one request may carry (a whole game for Speichern and Spielen; main.rb
# takes up to 20 MB): for the app's nginx, and for nginx-proxy in front of it on
# the live server (env.rb NGINX_PROXY_VHOST_PATH) – its default of 1 MB turns
# away every game above 1 MB with 413.
MAX_REQUEST_SIZE = '32m'
DEV_NEO4J_PORT = 8041
NEO4J_DATA_PATH = File::join(DATA_PATH, 'neo4j')
NEO4J_LOGS_PATH = File::join(LOGS_PATH, 'neo4j')
RAW_FILES_PATH = File::join(DATA_PATH, 'raw')
GEN_FILES_PATH = File::join(DATA_PATH, 'gen')

docker_compose = {
    :services => {},
}

docker_compose[:services][:nginx] = {
    :build => './docker/nginx',
    :volumes => [
        './src/static:/usr/share/nginx/html:ro',
        "#{RAW_FILES_PATH}:/raw:ro",
        "#{GEN_FILES_PATH}:/gen:ro",
        "#{LOGS_PATH}:/var/log/nginx",
    ]
}
if !DEVELOPMENT
    docker_compose[:services][:nginx][:environment] = [
        "VIRTUAL_HOST=#{WEBSITE_HOST}",
        "LETSENCRYPT_HOST=#{WEBSITE_HOST}",
        "LETSENCRYPT_EMAIL=#{LETSENCRYPT_EMAIL}"
    ]
    docker_compose[:services][:nginx][:expose] = ['80']
end

docker_compose[:services][:nginx][:links] = ["ruby:#{PROJECT_NAME}_ruby_1"]

nginx_config = <<~eos
    log_format custom '$http_x_forwarded_for - $remote_user [$time_local] "$request" '
                        '$status $body_bytes_sent "$http_referer" '
                        '"$http_user_agent" "$request_time"';

    # Cache busting: URLs with a version (?… – the server's cache buster or a
    # content hash from the recipe build) never change and may be cached forever.
    # Everything else is revalidated on every load (cheap 304), so an update is
    # always picked up.
    # The client's address for the Ruby app (collaboration limits guessing of
    # session codes per client). In production the reverse proxy in front
    # appends the real address as the last X-Forwarded-For entry; locally
    # there is no such header.
    map $http_x_forwarded_for $client_ip {
        "~(?<forwarded_ip>[^, ]+) *$" $forwarded_ip;
        default $remote_addr;
    }

    map $args $static_cache_control {
        ""      "no-cache";
        default "public, max-age=31536000, immutable";
    }

    server {
        listen 80;
        server_name localhost;
        server_tokens off;
        client_max_body_size #{MAX_REQUEST_SIZE};

        access_log /var/log/nginx/access.log custom;

        charset utf-8;
    
        gzip on;
        gzip_disable "msie6";

        gzip_vary on;
        gzip_proxied expired no-cache no-store private auth;
        # compression level
        gzip_comp_level 6;
        gzip_min_length 1000;
        gzip_buffers 16 8k;
        gzip_http_version 1.1;
        # files to gzip
        gzip_types text/plain
                   text/css
                   application/json
                   application/javascript
                   text/xml 
                   application/xml 
                   application/xml+rss 
                   text/javascript
                   image/x-icon
                   image/svg+xml;

        location /gen/ {
            add_header Cache-Control max-age=60;
            rewrite ^/gen(.*)$ $1 break;
            root /gen;
        }

        location / {
            root /usr/share/nginx/html;
            add_header Cache-Control $static_cache_control;
            try_files $uri @ruby;
        }

        location @ruby {
            # While the app restarts, a page tells the children to wait and
            # reloads by itself once it is back (src/static/neustart.html). The
            # status stays 502–504, so the studio's requests still see that the
            # server is away (server_watch.js).
            error_page 502 503 504 /neustart.html;
            proxy_pass http://#{PROJECT_NAME}_ruby_1:3000;
            proxy_set_header Host $host;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection Upgrade;
            proxy_set_header X-Client-IP $client_ip;
        }
    }

eos
File::open('docker/nginx/default.conf', 'w') do |f|
    f.write nginx_config
end
docker_compose[:services][:nginx][:depends_on] = [:ruby]

env = []
env << 'DEVELOPMENT=1' if DEVELOPMENT
# Live collaboration is on unless env.rb sets COLLABORATION = false.
env << 'COLLABORATION=0' if defined?(COLLABORATION) && !COLLABORATION
# the address of the site, for links printed in the terminal (moderate.rb web);
# an env.rb from before WEB_ROOT: the live site's host
SITE_ROOT = defined?(WEB_ROOT) ? WEB_ROOT : (!DEVELOPMENT && defined?(WEBSITE_HOST) ? "https://#{WEBSITE_HOST}" : nil)
env << "WEB_ROOT=#{SITE_ROOT}" if SITE_ROOT
# neo4j_bolt gives up waiting for Neo4j after this many seconds (default 30)
# and the server would not start; Neo4j 5 can take longer after an update
env << 'NEO4J_BOLT_WAIT_ATTEMPTS=180'
docker_compose[:services][:ruby] = {
    :build => './docker/ruby',
    :volumes => ['./src/ruby:/app:ro',
                 './src/static:/static:ro',
                 "#{RAW_FILES_PATH}:/raw",
                 "#{GEN_FILES_PATH}:/gen"],
    :environment => env,
    :working_dir => '/app',
    :entrypoint =>  DEVELOPMENT ?
        'rerun -b --dir /app -s SIGKILL \'thin --rackup config.ru --threaded start -e development\'' :
        'thin --rackup config.ru --threaded start -e production'
}
docker_compose[:services][:ruby][:depends_on] ||= []
docker_compose[:services][:ruby][:depends_on] << :neo4j
docker_compose[:services][:ruby][:links] = ['neo4j:neo4j']

docker_compose[:services][:neo4j] = {
    :build => './docker/neo4j',
    :volumes => ["#{NEO4J_DATA_PATH}:/data",
                 "#{NEO4J_LOGS_PATH}:/logs"]
}
# Neo4j 5 refuses to start with a setting it does not know (the 4.4 ones
# dbms.allow_upgrade and dbms.logs.timezone are gone): add only current names.
docker_compose[:services][:neo4j][:environment] = [
    'NEO4J_AUTH=none',
]
docker_compose[:services][:neo4j][:user] = "#{UID}"
docker_compose[:services][:ruby][:user] = "#{UID}"

docker_compose[:services].values.each do |x|
    x[:network_mode] = 'default'
end

if DEVELOPMENT
    docker_compose[:services][:nginx][:ports] = ["0.0.0.0:#{DEV_NGINX_PORT}:80"]
end
if DEVELOPMENT
    docker_compose[:services][:neo4j][:ports] = ["127.0.0.1:#{DEV_NEO4J_PORT}:7474",
                                                 "127.0.0.1:7688:7687"]
else
    docker_compose[:services].values.each do |x|
        x[:restart] = :always
    end
end

docker_compose[:services].each_pair do |k, v|
    v[:environment] ||= []
    v[:environment] << "SERVICE=#{k}"
end

File::open('docker-compose.yaml', 'w') do |f|
    f.puts "# NOTICE: don't edit this file directly, use config.rb instead!\n"
    f.write(JSON::parse(docker_compose.to_json).to_yaml)
end

FileUtils::mkpath(LOGS_PATH)
FileUtils::cp('src/ruby/Gemfile', 'docker/ruby/')
FileUtils::mkpath(File::join(RAW_FILES_PATH, 'uploads'))
# collaboration sessions across restarts (private: /raw is not served)
FileUtils::mkpath(File::join(RAW_FILES_PATH, 'collaboration'))
# Fehlerberichte from the studio (src/ruby/client_errors.rb; private as well)
FileUtils::mkpath(File::join(RAW_FILES_PATH, 'client-errors'))
# Playtesting in the classroom (src/ruby/playtesting.rb, playtest.rb)
FileUtils::mkpath(File::join(RAW_FILES_PATH, 'playtesting'))
# Moderation: the log of deleted games and the open moderation page (src/ruby/moderation.rb, moderate.rb),
# and the site's address for the link moderate.rb prints – written on every run, so it follows env.rb
FileUtils::mkpath(File::join(RAW_FILES_PATH, 'moderation'))
File.write(File::join(RAW_FILES_PATH, 'moderation', 'adresse.txt'), "#{SITE_ROOT}\n") if SITE_ROOT
FileUtils::mkpath(GEN_FILES_PATH)
FileUtils::mkpath(File.join(GEN_FILES_PATH, 'png'))
FileUtils::mkpath(File.join(GEN_FILES_PATH, 'games'))
FileUtils::mkpath(NEO4J_DATA_PATH)
FileUtils::mkpath(NEO4J_LOGS_PATH)

# nginx-proxy (VIRTUAL_HOST above) reads extra settings for the site's
# location from <host>_location in its vhost.d folder: the same request size as
# the app's nginx. Not the file named like the host: that one would replace
# vhost.d/default for the site, where the acme companion may keep the
# Let's Encrypt challenge. Other lines in the file stay as they are.
if !DEVELOPMENT && defined?(NGINX_PROXY_VHOST_PATH) && NGINX_PROXY_VHOST_PATH
    vhost_file = File::join(NGINX_PROXY_VHOST_PATH, "#{WEBSITE_HOST}_location")
    line = "client_max_body_size #{MAX_REQUEST_SIZE};\n"
    begin
        old = File.exist?(vhost_file) ? File.read(vhost_file) : ''
        kept = old.lines.map { |l| l.end_with?("\n") ? l : l + "\n" }.reject { |l| l =~ /^\s*client_max_body_size\b/ }
        wanted = (kept + [line]).join
        if wanted != old
            FileUtils::mkpath(NGINX_PROXY_VHOST_PATH)
            File.write(vhost_file, wanted)
            puts "#{vhost_file}: #{line.strip}"
            puts "nginx-proxy übernimmt das, wenn er neu startet: docker restart <nginx-proxy-Container>"
        end
    rescue SystemCallError => e
        puts "Konnte #{vhost_file} nicht schreiben (#{e.message})."
        puts "Bitte dort von Hand eintragen: #{line.strip}"
    end
end

`docker compose 2> /dev/null`
DOCKER_COMPOSE = ($? == 0) ? 'docker compose' : 'docker-compose'
system("#{DOCKER_COMPOSE} --compatibility --project-name #{PROJECT_NAME} #{ARGV.map { |x| '"' + x + '"'}.join(' ')}")
