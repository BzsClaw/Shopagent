docker ps --filter name=open-design --format "{{.Names}} {{.Status}}"
docker exec open-design node -e "fetch('http://127.0.0.1:7456/api/health').then(r=>r.text()).then(t=>console.log('HEALTH:',t)).catch(e=>console.log('HEALTH ERR:',e.message))"
