#!/usr/bin/env ruby

require 'json'
require 'yaml'
require 'digest'
require 'fileutils'

FileUtils.mkpath('/gen/catalogue')

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
