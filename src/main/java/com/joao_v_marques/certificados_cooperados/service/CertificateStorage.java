package com.joao_v_marques.certificados_cooperados.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Component
public class CertificateStorage {

    private final Path root;

    public CertificateStorage(@Value("${app.certificados.diretorio}") String certificatesDirectory) {
        this.root = Paths.get(certificatesDirectory).toAbsolutePath().normalize();
    }

    public Path resolve(String storedPath) {
        Path destination = root.resolve(storedPath).normalize();

        if (!destination.startsWith(root)) {
            throw new IllegalArgumentException("Caminho de destino inválido.");
        }

        return destination;
    }

    public void write(MultipartFile file, String storedPath) {
        try {
            Path destination = resolve(storedPath);

            // Cria storage/certificados/<cooperado>/ se ainda não existir
            Files.createDirectories(destination.getParent());

            try (InputStream in = file.getInputStream()) {
                Files.copy(in, destination);
            }

        } catch (IOException e) {
            throw new UncheckedIOException("Falha ao gravar o certificado em disco", e);
        }
    }
}
