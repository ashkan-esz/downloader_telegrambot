build-image:
	docker image build -t downloader-telegrambot --network=host .

run-image:
	docker run --network=host --restart=always --memory 150m --memory-swap 200m --cpus=".2" --env-file ./.env downloader-telegrambot

push-image:
	docker tag downloader-telegrambot ashkanaz2828/downloader_telegrambot
	docker push ashkanaz2828/downloader_telegrambot