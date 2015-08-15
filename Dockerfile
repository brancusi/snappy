# Getting from this base so we can override some of the build steps
FROM resin/raspberrypi2-node:0.12.4

# Setup base app dir
ENV APP /usr/src/app
RUN mkdir -p $APP
WORKDIR $APP

# We need to install pm2 globally so it can be found.
RUN npm install pm2 -g

# Install image tools
RUN apt-get update && apt-get install -y \
  dcraw \
  gphoto2

# Run npm install here to cache this later for future builds
COPY package.json $APP

# Squash the nasty output
RUN DEBIAN_FRONTEND=noninteractive JOBS=MAX npm install --unsafe-perm

# Copy over app source
COPY . $APP

# Use Systemd in container: https://resin.io/blog/brand-new-base-images/
ENV INITSYSTEM on

# Start up the app
CMD [ "bash", "./start.sh" ]