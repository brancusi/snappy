# Getting from this base so we can override some of the build steps
FROM resin/raspberrypi2-node:0.12.4

# Setup base app dir
ENV APP_BASE /usr/src/app
RUN mkdir -p $APP_BASE
WORKDIR $APP_BASE

# Install image tools
RUN apt-get update && apt-get install -y \
  dcraw \
  gphoto2 \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# We need to install pm2 globally so it can be found. Squash the nasty output.
RUN npm install pm2 -g --unsafe-perm --loglevel verbose

# Run npm install here to cache this later for future builds
COPY package.json $APP_BASE/

# Run npm install and squash the nasty output.
RUN DEBIAN_FRONTEND=noninteractive JOBS=MAX npm install --unsafe-perm

VOLUME /data

# Copy over app source
COPY . $APP_BASE

# Use Systemd in container: https://resin.io/blog/brand-new-base-images/
ENV INITSYSTEM on

# Start up the app
CMD [ "bash", "$APP_BASE/start.sh" ]