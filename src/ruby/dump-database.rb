#!/usr/bin/env ruby
SKIP_COLLECT_DATA = true
require './main.rb'

class DumpDatabase
    include QtsNeo4j

    def run
        node_ids = []
        neo4j_query("MATCH (n) RETURN id(n) as id ORDER BY id;").each do |result|
            node_ids << result['id']
        end
        node_ids.each_slice(1000) do |ids|
            neo4j_query("MATCH (n) WHERE id(n) IN $ids RETURN id(n) as id, labels(n) as labels, n as n;", :ids => ids).each do |result|
                node = {
                    :id => result['id'],
                    :labels => result['labels'],
                    :properties => result['n']
                }
                puts "n #{node.to_json}"
            end
        end
        rel_ids = []
        neo4j_query("MATCH ()-[r]->() RETURN id(r) as id ORDER BY id;").each do |result|
            rel_ids << result['id']
        end
        rel_ids.each_slice(1000) do |ids|
            neo4j_query("MATCH ()-[r]->() WHERE id(r) in $ids RETURN type(r) as type, id(r) as id, id(startnode(r)) as from, id(endnode(r)) as to, r as r;", :ids => ids).each do |result|
                relationship = {
                    :id => result['id'],
                    :type => result['type'],
                    :from => result['from'],
                    :to => result['to'],
                    :properties => result['r']
                }
                puts "r #{relationship.to_json}"
            end
        end
    end
end

dump = DumpDatabase.new
dump.run


# MATCH (n) RETURN id(n) as id, labels(n) as labels, n as n;
# MATCH ()-[r]->() RETURN type(r) as type, id(r) as id, id(startnode(r)) as from, id(endnode(r)) as to, r as r;
