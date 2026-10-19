FROM alpine:3.20
RUN apk add --no-cache curl tzdata busybox-suid
ENV TZ=Asia/Ho_Chi_Minh
COPY crontab /etc/crontabs/root
COPY entrypoint.sh run.sh alert.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/run.sh /usr/local/bin/alert.sh
CMD ["/usr/local/bin/entrypoint.sh"]
