#!/usr/bin/env ruby

require 'json'
require 'yaml'
require 'digest'
require 'fileutils'
require "neo4j_bolt"

Neo4jBolt.bolt_host = "neo4j"
Neo4jBolt.bolt_port = 7687

FileUtils.mkpath('/gen/catalogue')

class Neo4jGlobal
    include Neo4jBolt
end

$neo4j = Neo4jGlobal.new

nodes = $neo4j.neo4j_query(<<~END_OF_QUERY)
    MATCH (g:Game)
    WHERE NOT (:Game)-[:PARENT]->(g)
    OPTIONAL MATCH (g)-[:PARENT*]->(p:Game)
    OPTIONAL MATCH (g)-[:AUTHOR]->(a:String)
    OPTIONAL MATCH (g)-[:TITLE]->(t:String)
    RETURN g.tag AS tag, a.content AS author, t.content AS title;
END_OF_QUERY

games = {}

nodes.each do |node|
    node['author'] ||= ''
    node['title'] ||= ''
    node['author'].downcase!
    node['author'].strip!
    node['title'].downcase!
    node['title'].strip!
    games[node['tag']] = node
end

tags_sorted = games.keys.sort do |a, b|
    ga = games[a]
    gb = games[b]
    if ga['author'] == gb['author']
        ga['title'] <=> gb['title']
    else
        ga['author'] <=> gb['author']
    end
end.reverse

tags_sorted.each do |tag|
    game = games[tag]
    STDERR.puts "#{tag} >> #{game['author']} / #{game['title']}"
end

# exit

Dir['/gen/games/*.json'].each do |file|
    game = JSON.parse(File.read(file))
    game['sprites'].each do |sprite|
        sprite['states'].each do |state|
            frames = state['frames']
            # next unless frames.size > 1
            fps = (state['properties'] || {})['fps'] || 8
            # next if fps == 8
            tags = frames.map { |x| "/gen/png/#{x['tag']}.png" }
            config = {:tags => tags, :fps => fps}
            out_tag = Digest::SHA1.hexdigest(config.to_json)[0, 12]
            out_path = "/gen/catalogue/#{out_tag}.gif"
            next if File.exist?(out_path)
            command = "convert -delay #{100 / fps} -dispose previous #{tags.join(' ')} #{out_path}"
            puts command
            system(command)
            # exit
        end
    end
end
