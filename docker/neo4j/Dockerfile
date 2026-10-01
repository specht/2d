FROM neo4j:4.4-community

ENV TZ=Europe/Berlin

RUN cp /usr/share/zoneinfo/Europe/Berlin /etc/localtime \
    && echo "Europe/Berlin" > /etc/timezone

USER 1000:1000