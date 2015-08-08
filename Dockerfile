FROM nghiant2710/rpi-node

RUN npm install pm2 -g

RUN apt-get update && apt-get install -y \
  gphoto2

COPY . /app

WORKDIR /app

RUN npm install

ENV INITSYSTEM on

CMD ["bash", "/app/start.sh"]
