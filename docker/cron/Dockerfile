FROM alpine:3.20
RUN apk add --no-cache curl tzdata busybox-suid
ENV TZ=Asia/Ho_Chi_Minh
COPY crontab /etc/crontabs/root
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
CMD ["/usr/local/bin/entrypoint.sh"]
