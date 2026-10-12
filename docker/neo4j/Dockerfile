# Neo4j 5.26 LTS. A 4.4 database moves over with ./migrate-neo4j.rb (README).
FROM neo4j:5.26-community

ENV TZ=Europe/Berlin

RUN cp /usr/share/zoneinfo/Europe/Berlin /etc/localtime \
    && echo "Europe/Berlin" > /etc/timezone

USER 1000:1000