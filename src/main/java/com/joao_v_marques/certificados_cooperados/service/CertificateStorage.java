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

/**
 * A pasta de certificados em disco: o único lugar que transforma o `stored_path`
 * gravado no banco em caminho de verdade.
 *
 * Gravação e leitura passam pela mesma conferência de caminho. Deixar essa
 * conferência espalhada seria o pior tipo de duplicação: quem esquecesse dela ao
 * escrever um caminho vindo do banco abriria a porta para ler qualquer arquivo
 * do servidor.
 */
@Component
public class CertificateStorage {

    private final Path root;

    public CertificateStorage(@Value("${app.certificados.diretorio}") String certificatesDirectory) {
        this.root = Paths.get(certificatesDirectory).toAbsolutePath().normalize();
    }

    /**
     * Resolve o caminho relativo dentro da pasta de certificados.
     *
     * O resultado precisa continuar debaixo dela: `stored_path` sai do banco, e
     * um valor com `../` apontaria para fora sem esta barreira.
     */
    public Path resolve(String storedPath) {
        Path destination = root.resolve(storedPath).normalize();

        if (!destination.startsWith(root)) {
            throw new IllegalArgumentException("Caminho de destino inválido.");
        }

        return destination;
    }

    /**
     * Grava o arquivo enviado em `storedPath`, criando a pasta do cooperado se
     * ainda não existir.
     *
     * A falha de I/O vira UncheckedIOException de propósito: este método é
     * chamado dentro da transação que grava curso e certificado, e exceção
     * checada não dispara rollback sozinha.
     */
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
