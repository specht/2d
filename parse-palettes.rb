#!/usr/bin/env ruby

require 'json'

palettes = []
keys = {
    :name => 'Palette Name',
    :description => 'Description'
}

Dir['palettes/*.txt'].each do |path|
    entry = {:colors => []}
    File.open(path) do |f|
        f.each_line do |line|
            if line[0] == ';'
                keys.each_pair do |k, v|
                    if line.index(";#{v}:") == 0
                        entry[k] = line.sub(";#{v}:", '').strip
                    end
                end
            else
                entry[:colors] << '#' + line.sub('FF', '').strip
            end
        end
    end
    palettes << entry
end

palettes.sort! do |a, b|
    a[:name].downcase <=> b[:name].downcase
end

File.open('palettes.js', 'w') do |f|
    f.write "var palettes = #{palettes.to_json};"
end