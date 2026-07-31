package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.CooperativeMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface CooperativeMemberRepository extends JpaRepository<CooperativeMember, Integer> {

    // As duas colunas são UNIQUE no banco; consultar antes evita que a violação
    // da constraint suba como erro genérico em vez de mensagem de negócio.
    boolean existsByNameIgnoreCase(String name);

    boolean existsByEmailIgnoreCase(String email);

    // Base do relatório anual: todo cooperado ativo entra na lista, inclusive
    // quem não lançou nenhum curso no ano — é justamente esse zero que alimenta
    // o indicador de "sem curso no ano". JPQL explícito em vez de query derivada
    // porque o campo se chama isActive e o nome derivado ficaria ambíguo.
    @Query("select m from CooperativeMember m where m.isActive = true order by m.name asc")
    List<CooperativeMember> findActiveOrderByName();
}
