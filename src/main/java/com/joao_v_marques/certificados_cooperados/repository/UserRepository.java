package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {

    @Query("SELECT u FROM User u JOIN FETCH u.role WHERE u.username = :username")
    Optional<User> findByUsername(@Param("username") String username);
}
