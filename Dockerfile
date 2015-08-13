FROM nghiant2710/rpi-node

RUN apt-get update && apt-get install -y \
  dcraw \
  gphoto2 \
  imagemagick

ENV APP_DIR /app

COPY package.json $APP_DIR/package.json

RUN cd $APP_DIR; npm install

COPY . $APP_DIR

WORKDIR $APP_DIR

VOLUME /data

ENV INITSYSTEM on

CMD ["bash", "/app/start.sh"]
