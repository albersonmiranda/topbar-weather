UUID = topbar-weather@datamares.netlify.app
ifeq ($(strip $(DESTDIR)),)
	INSTALLTYPE = local
	INSTALLBASE = $(HOME)/.local/share/gnome-shell/extensions
else
	INSTALLTYPE = system
	SHARE_PREFIX = $(DESTDIR)/usr/share
	INSTALLBASE = $(SHARE_PREFIX)/gnome-shell/extensions
endif
INSTALLNAME = topbar-weather@datamares.netlify.app

.PHONY: default
default: build

.PHONY: build
build:
	glib-compile-schemas ./topbar-weather@datamares.netlify.app/schemas

.PHONY: install
install: build
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)
	mkdir -p $(INSTALLBASE)/$(INSTALLNAME)
	cp -r ./topbar-weather@datamares.netlify.app/* $(INSTALLBASE)/$(INSTALLNAME)

.PHONY: uninstall
uninstall:
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)

.PHONY: clean
