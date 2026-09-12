package com.fooddelivery.repository;

import com.fooddelivery.common.enums.DriverStatus;
import com.fooddelivery.entity.DeliveryPartner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeliveryPartnerRepository extends JpaRepository<DeliveryPartner, Long> {

    List<DeliveryPartner> findByIsActiveTrue();

    List<DeliveryPartner> findByStatusAndIsActiveTrue(DriverStatus status);

    List<DeliveryPartner> findByCityAndIsActiveTrue(String city);

    List<DeliveryPartner> findByCityAndStatusAndIsActiveTrue(String city, DriverStatus status);
}
