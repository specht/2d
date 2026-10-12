#!/usr/bin/env ruby
# Moves the database from Neo4j 4.4 to the Neo4j 5 in docker/neo4j/Dockerfile.
#
# Neo4j 5 cannot open a 4.4 store. This is Neo4j's way for the Community
# edition: dump the database with 4.4, load the dump with 5, migrate its store
# (BTREE indexes become RANGE indexes). The 4.4 data is never changed (the dump
# only takes its store lock): everything new is built next to it, and only at the very end the folders are
# renamed – data/neo4j becomes data/neo4j-4.4, the new one data/neo4j. Going
# back is renaming them back. The system database is not carried over: with
# NEO4J_AUTH=none it holds nothing of ours, Neo4j 5 creates a fresh one.
#
#   ./config.rb exec -T ruby ruby db-fingerprint.rb > fingerprint-vorher.txt
#   ./config.rb stop
#   ./migrate-neo4j.rb            # sudo, if data/neo4j belongs to another user
#   ./config.rb build && ./config.rb up -d
#   ./config.rb exec -T ruby ruby db-fingerprint.rb > fingerprint-nachher.txt

require 'fileutils'
require 'open3'

Dir.chdir(__dir__)
require './env.rb'

# the last 4.4 release; 4.4 patch releases share one store format
SOURCE_IMAGE = 'neo4j:4.4.48-community'
TARGET_IMAGE = File.read('docker/neo4j/Dockerfile')[/^FROM\s+(\S+)/, 1]
NEO4J_DATA_PATH = File.expand_path(File.join(DATA_PATH, 'neo4j'))
OLD_DATA_PATH = "#{NEO4J_DATA_PATH}-4.4"
WORK_PATH = File.expand_path(File.join(DATA_PATH, 'neo4j-migration'))
NEW_DATA_PATH = File.join(WORK_PATH, 'data-5')
DUMP_FILE = File.join(WORK_PATH, 'neo4j.dump')

def fail_with(message)
    STDERR.puts message
    exit 1
end

def run_in(image, data_path, logs_name, *command)
    logs_path = File.join(WORK_PATH, logs_name)
    FileUtils.mkpath(logs_path)
    # run with sudo: the containers (as the owner of the database) write here
    FileUtils.chown_R(RUN_UID, nil, WORK_PATH) if Process.uid == 0 && RUN_UID != 0
    args = ['docker', 'run', '--rm', '--user', RUN_UID.to_s,
            '-v', "#{data_path}:/data", '-v', "#{WORK_PATH}:/backups", '-v', "#{logs_path}:/logs",
            image, *command]
    puts "== #{command.join(' ')} (#{image})"
    system(*args) || fail_with(<<~END_OF_TEXT)

        Das hat nicht geklappt (siehe oben). data/neo4j ist unverändert, die Datenbank läuft wie vorher.
        Wenn 4.4 nicht sauber beendet wurde ("recovery"): einmal mit dem alten Stand starten und mit ./config.rb stop beenden.
        Aufräumen vor dem nächsten Versuch: rm -rf #{WORK_PATH}
    END_OF_TEXT
end

fail_with "docker/neo4j/Dockerfile nennt kein Neo4j-5-Image (#{TARGET_IMAGE.inspect})." unless TARGET_IMAGE.to_s =~ /\Aneo4j:5\./
if File.exist?(OLD_DATA_PATH)
    fail_with <<~END_OF_TEXT
        #{OLD_DATA_PATH} gibt es schon: Die Datenbank ist schon umgezogen.
        Zurück zu 4.4: ./config.rb stop; mv #{NEO4J_DATA_PATH} #{NEO4J_DATA_PATH}-5; mv #{OLD_DATA_PATH} #{NEO4J_DATA_PATH}; dann den alten Stand bauen und starten.
    END_OF_TEXT
end
databases_path = File.join(NEO4J_DATA_PATH, 'databases')
fail_with "In #{NEO4J_DATA_PATH} ist keine Datenbank: Nichts umzuziehen, Neo4j 5 legt eine neue an." unless File.directory?(databases_path)
# The containers run as the owner of the database (normally UID in env.rb):
# they read the 4.4 store, and the new one belongs to the same user.
RUN_UID = File.stat(databases_path).uid
if Process.uid != RUN_UID && Process.uid != 0
    fail_with <<~END_OF_TEXT
        #{databases_path} gehört UID #{RUN_UID}, dieser Benutzer ist UID #{Process.uid}.
        Bitte so: sudo ./migrate-neo4j.rb
    END_OF_TEXT
end
puts "Achtung: Die Datenbank gehört UID #{RUN_UID}, env.rb setzt UID = #{UID} (so läuft Neo4j)." if RUN_UID != UID && !(Process.uid == 0 && UID == 0)
begin
    names = Dir.children(databases_path).select { |name| File.directory?(File.join(databases_path, name)) } - ['system']
rescue Errno::EACCES
    fail_with "#{databases_path} ist nicht lesbar (#{File.stat(databases_path).mode.to_s(8)[-3..]}). Bitte so: sudo ./migrate-neo4j.rb"
end
# Neo4j's default database is neo4j; an older setup may name it differently.
# Neo4j 5 gets it as neo4j, its default, whatever it was called before.
SOURCE_DATABASE = if ARGV[0]
    names.include?(ARGV[0]) ? ARGV[0] : fail_with("#{ARGV[0]} gibt es nicht in #{databases_path} (da: #{names.join(', ')}).")
elsif names.include?('neo4j') || names.size == 1
    names.include?('neo4j') ? 'neo4j' : names.first
elsif names.empty?
    fail_with "In #{databases_path} ist keine Datenbank: Nichts umzuziehen, Neo4j 5 legt eine neue an."
else
    fail_with "In #{databases_path} liegen mehrere Datenbanken: #{names.join(', ')}. Welche gehört zum Studio? ./migrate-neo4j.rb <Name>"
end
puts "Datenbank: #{SOURCE_DATABASE} (UID #{RUN_UID})"
running, error, status = Open3.capture3('docker', 'ps', '-q',
    '--filter', "label=com.docker.compose.project=#{PROJECT_NAME}",
    '--filter', 'label=com.docker.compose.service=neo4j')
fail_with "Docker antwortet nicht: #{error.strip}" unless status.success?
fail_with "Neo4j läuft noch. Bitte zuerst: ./config.rb stop" unless running.strip.empty?
fail_with "#{WORK_PATH} gibt es schon (ein früherer Versuch?). Bitte ansehen und löschen: rm -rf #{WORK_PATH}" if File.exist?(WORK_PATH)

FileUtils.mkpath(NEW_DATA_PATH)
run_in(SOURCE_IMAGE, NEO4J_DATA_PATH, 'logs-4.4',
    'neo4j-admin', 'dump', "--database=#{SOURCE_DATABASE}", '--to=/backups/neo4j.dump')
fail_with "Der Dump fehlt: #{DUMP_FILE}" unless File.size?(DUMP_FILE)
run_in(TARGET_IMAGE, NEW_DATA_PATH, 'logs-5',
    'neo4j-admin', 'database', 'load', 'neo4j', '--from-path=/backups')
run_in(TARGET_IMAGE, NEW_DATA_PATH, 'logs-5',
    'neo4j-admin', 'database', 'migrate', '--to-format=aligned', '--force-btree-indexes-to-range', 'neo4j')

FileUtils.mv(NEO4J_DATA_PATH, OLD_DATA_PATH)
FileUtils.mv(NEW_DATA_PATH, NEO4J_DATA_PATH)

puts <<~END_OF_TEXT

    Fertig: #{NEO4J_DATA_PATH} ist jetzt die Datenbank für #{TARGET_IMAGE}.
    Die alte 4.4-Datenbank liegt unverändert in #{OLD_DATA_PATH}, der Dump in #{DUMP_FILE}.

    Weiter:
      ./config.rb build
      ./config.rb up -d
      ./config.rb exec -T ruby ruby db-fingerprint.rb > fingerprint-nachher.txt
      diff fingerprint-vorher.txt fingerprint-nachher.txt   # gleiche SHA-256-Zeile: nichts verloren
END_OF_TEXT
