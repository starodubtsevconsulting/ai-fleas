#!/usr/bin/env bash
external_disks(){ lsblk -dn -p -o NAME,TYPE,TRAN | awk '$2=="disk" && ($3=="usb" || $3=="sata"){print $1}'; }
storage_inventory(){ lsblk -d -o NAME,PATH,SIZE,MODEL,SERIAL,TRAN,ROTA,TYPE,FSTYPE,MOUNTPOINTS; }
