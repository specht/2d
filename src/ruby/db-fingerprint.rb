#!/usr/bin/env ruby
# A fingerprint of everything in the Neo4j database: how many nodes and
# relationships of each kind, and one SHA-256 over all of them with all their
# properties. Run it before and after a database upgrade (migrate-neo4j.rb);
# the same SHA-256 means nothing was lost or changed on the way.
#
#   ./config.rb exec -T ruby ruby db-fingerprint.rb > fingerprint-vorher.txt
#
# Nodes are identified by their labels and properties (never by internal ids,
# which a migration may change), relationships by their type, properties and
# both ends. Indexes are listed, but stay out of the SHA-256: Neo4j 5 turns the
# BTREE indexes of 4.4 into RANGE indexes. Only scalars and maps are read, so
# this works with every neo4j_bolt version on both sides of an upgrade.

require "digest"
require "json"
require "neo4j_bolt"

Neo4jBolt.bolt_host = "neo4j"
Neo4jBolt.bolt_port = 7687

class Fingerprint
    include Neo4jBolt
end

# property maps come back with symbol keys: sorted string keys, so the line
# only depends on the content
def canonical(value)
    case value
    when Hash then value.map { |k, v| [k.to_s, canonical(v)] }.sort_by(&:first).to_h
    when Array then value.map { |v| canonical(v) }
    else value
    end
end

def node_line(labels, properties)
    JSON.generate([labels.sort, canonical(properties || {})])
end

db = Fingerprint.new
db.wait_for_neo4j

node_lines = []
db.neo4j_query("MATCH (n) RETURN labels(n) AS labels, properties(n) AS properties;").each do |row|
    node_lines << node_line(row["labels"], row["properties"])
end
relationship_lines = []
db.neo4j_query(<<~END_OF_QUERY).each do |row|
    MATCH (a)-[r]->(b)
    RETURN type(r) AS type, properties(r) AS properties,
           labels(a) AS a_labels, properties(a) AS a_properties,
           labels(b) AS b_labels, properties(b) AS b_properties;
END_OF_QUERY
    relationship_lines << JSON.generate([row["type"], canonical(row["properties"] || {}),
        node_line(row["a_labels"], row["a_properties"]), node_line(row["b_labels"], row["b_properties"])])
end

digest = Digest::SHA256.new
node_lines.sort.each { |line| digest << "n " << line << "\n" }
relationship_lines.sort.each { |line| digest << "r " << line << "\n" }

server = db.neo4j_query("CALL dbms.components() YIELD name, versions, edition RETURN name, versions[0] AS version, edition;").first
puts "Server: #{server["name"]} #{server["version"]} #{server["edition"]}"
puts "neo4j_bolt: #{Neo4jBolt::VERSION}"
puts
node_counts = Hash.new(0)
db.neo4j_query("MATCH (n) RETURN labels(n) AS labels, COUNT(*) AS count;").each do |row|
    node_counts[row["labels"].sort.join(":")] += row["count"]
end
node_counts.sort.each { |labels, count| puts "Knoten #{labels.empty? ? "(ohne Label)" : labels}: #{count}" }
db.neo4j_query("MATCH ()-[r]->() RETURN type(r) AS type, COUNT(*) AS count ORDER BY type;").each do |row|
    puts "Beziehungen #{row["type"]}: #{row["count"]}"
end
puts "Knoten mit gleichem Inhalt: #{node_lines.size - node_lines.uniq.size}"
puts
begin
    db.neo4j_query("SHOW INDEXES YIELD name, type, labelsOrTypes, properties RETURN name, type, labelsOrTypes, properties ORDER BY name;").each do |row|
        puts "Index #{row["name"]}: #{row["type"]} #{(row["labelsOrTypes"] || []).join(",")} #{(row["properties"] || []).join(",")}"
    end
rescue StandardError => e
    puts "Indexe: nicht lesbar (#{e.message.lines.first&.strip})"
end
puts
puts "SHA-256: #{digest.hexdigest}"
