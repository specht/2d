#!/usr/bin/env ruby

require 'json'
require 'yaml'
require 'digest'
require 'fileutils'
require 'neo4j_bolt'
require 'open3'
require 'set'

Neo4jBolt.bolt_host = "neo4j"
Neo4jBolt.bolt_port = 7687

class Neo4jGlobal
    include Neo4jBolt
end

$neo4j = Neo4jGlobal.new

nodes = {}

$neo4j.neo4j_query(<<~END_OF_QUERY).each do |row|
    MATCH (g:Game)
    OPTIONAL MATCH (g)-[:PARENT]->(p:Game)
    OPTIONAL MATCH (g)-[:AUTHOR]->(ga:String)
    OPTIONAL MATCH (g)-[:TITLE]->(gt:String)
    RETURN g, p.tag AS p, ga.content AS ga, gt.content AS gt;
END_OF_QUERY
    nodes[row['g'][:tag]] ||= {}
    row['g'].each_pair do |key, value|
        nodes[row['g'][:tag]][key] = value
    end
    nodes[row['g'][:tag]][:author] = row['ga']
    nodes[row['g'][:tag]][:title] = row['gt']
    nodes[row['g'][:tag]][:parent] = row['p']
end

nodes.each_pair do |tag, node|
    node[:children] ||= []
    if node[:parent]
        nodes[node[:parent]][:children] ||= []
        nodes[node[:parent]][:children] << tag
    end
end

root_tags = nodes.keys.select do |tag|
    nodes[tag][:parent].nil?
end

STDERR.puts "Got #{root_tags.size} root nodes!"

def distribute_root_tag(nodes, root_tag, tag)
    nodes[tag][:root] = root_tag
    all_labels = Set.new()
    nodes[tag][:children].each do |child_tag|
        distribute_root_tag(nodes, root_tag, child_tag)
        node = nodes[child_tag]
        label = [node[:author] || '', node[:title] || ''].reject { |x| x.strip.empty? }.join(" / ").strip
        all_labels << label
    end
    if all_labels.size == 1
        node = nodes[tag]
        label = [node[:author] || '', node[:title] || ''].reject { |x| x.strip.empty? }.join(" / ").strip
        if label == all_labels.to_a.first
            nodes[tag][:children].each do |child_tag|
                nodes[child_tag][:author] = ''
                nodes[child_tag][:title] = ''
            end
        end
    end
end

root_tags.each do |root_tag|
    distribute_root_tag(nodes, root_tag, root_tag)
end

def compact(nodes)
    # STDERR.puts "Compacting #{nodes.size} nodes!"
    loop do
        nodes.each_pair do |tag, node|
            if node[:parent]
                parent_tag = node[:parent]
                if nodes[parent_tag][:children].size == 1
                    if node[:children].size == 1
                        child_tag = node[:children].first
                        # if node[:title] == nodes[node[:parent]][:title]
                        #     if node[:author] == nodes[node[:parent]][:author]
                                tag = node[:tag]
                                nodes[parent_tag][:children] = [node[:children].first]
                                nodes[parent_tag][:skipped_children] ||= 0
                                nodes[parent_tag][:skipped_children] += (node[:skipped_children] || 0)
                                nodes[parent_tag][:skipped_children] += 1
                                nodes[child_tag][:parent] = node[:parent]
                                nodes.delete(tag)
                                next
                        #     end
                        # end
                    end
                end
            end
        end
        break
    end
end

compact(nodes)
STDERR.puts "Ended up with #{nodes.size} nodes!"

root_tags.each do |root_tag|
    # next unless root_tag == 'o3bbng1'
    ts_min = nil
    ts_max = nil

    nodes.each_pair do |tag, node|
        next unless node[:root] == root_tag
        ts = node[:ts_created]
        STDERR.puts node.to_json
        if ts
            ts_min ||= ts
            ts_max ||= ts
            ts_min = ts if ts < ts_min
            ts_max = ts if ts > ts_max
        end
    end
    ts_min ||= 0
    ts_max ||= 0

    FileUtils.mkpath('/gen/graphs')
    dot = StringIO.open do |io|
        io.puts "digraph {"
        io.puts "graph [fontname = Helvetica, fontsize = 10, nodesep = 0.2, ranksep = 0.3, bgcolor = transparent];"
        io.puts "node [fontname = Helvetica, fontsize = 10, shape = rect, margin = 0, style = filled, color = \"#ffffff\"];"
        io.puts "edge [fontname = Helvetica, fontsize = 10, arrowsize = 0.6, color = \"#ffffff\", fontcolor = \"#ffffff\"];"
        io.puts 'rankdir=LR;'
        io.puts 'splines=true;'
        nodes.each_pair do |tag, node|
            next unless node[:root] == root_tag
            t = 1.0
            if (ts_max - ts_min).abs > 0.1
                t = (node[:ts_created] - ts_min).to_f / (ts_max - ts_min)
            end
            opacity = t
            # color = rgb_to_hex(mix(hex_to_rgb('#808080'), hex_to_rgb('#ffffff'), t))
            color = '#ffffff'
            label = [node[:author] || '', node[:title] || ''].reject { |x| x.strip.empty? }.join(" / ").strip
            # if label.empty?
                io.puts "\"g#{tag}\" [id = \"g#{tag}\", fillcolor = \"#{color}#{sprintf('%02x', (opacity * 255).to_i)}\", shape = circle, fixedsize = true, label = \"\", width = #{t * 0.1 + 0.05} pencolor = \"#000000\"];"
            # else
                # io.puts "\"g#{tag}\" [fillcolor = \"#{color}\" label = \"#{label}\", pencolor = \"#000000\"];"
            # end
            # if row['p']
            #     puts "g#{row['p']} -> g#{row['g']};"
            # end
        end
        nodes.each_pair do |tag, node|
            next unless node[:root] == root_tag
            if node[:parent]
                io.puts "\"g#{node[:parent]}\" -> \"g#{tag}\" [label = \"#{nodes[node[:parent]][:skipped_children]}\"];";
            end
        end
        io.puts "}"
        io.string
    end

    svg, status = Open3.capture2("dot -Tsvg", :stdin_data => dot)
    File.open("/gen/graphs/#{root_tag}.svg", 'w') do |f|
        f.write svg
    end
end
