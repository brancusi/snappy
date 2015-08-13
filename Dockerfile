FROM nghiant2710/rpi-node

RUN npm install pm2 -g

RUN apt-get update && apt-get install -y \
  gphoto2 \
  dcraw

COPY package.json /app/package.json

RUN cd /app; npm install

COPY . /app

WORKDIR /app

ENV INITSYSTEM on

CMD ["bash", "/app/start.sh"]
