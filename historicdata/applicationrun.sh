#!/bin/bash

set -e

rm -rf target/

cd ..

git pull

cd historicdata/

chmod +x mvnw

./mvnw package

java -jar target/historicdata-0.0.1-SNAPSHOT.jar